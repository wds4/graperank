import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { GrapeRank, ResponseData, Scorecards } from '@/types'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { convertInputToConfidence } from '@/helpers/grapevine'

/*
This endpoint is likely to be deprecated or reworked in favor of:
1. use neo4j to create reverseObserveeObject for each user (one at a time) and store in sql
2. update reverseObserveeObject for a user each time a rating is added or deleted, using flag to id user

currently: 'f' or 'm'; MIGHT change to [1, 0.05] vs [0, 0.1]

Rework this endpoint; start this endpoint at step 3:
3. create reverseRatingsObject by aggregating each reverseObserveeObject on the fly; should take about 10 seconds
4. initialize Scorecards
5. use reverseRatingsObject as input into GrapeRank

- STEP 1: 
  sql0: SELECTE id FROM users WHERE pubkey='${observer}'
  sql1: SELECT id, reverseObserveeObject FROM users WHERE reverseObserveeObject IS NULL NOT NULL 

- STEP 2: combine results of sql1 into one large raw data object oRatingsReverse of format: [context][ratee][rater] = [score, confidence]

Calculate PageRank scores for all pubkeys 
- STEP 1: sql1: SELECT id, pubkey, observeeObject FROM users WHERE observeeObject IS NULL NOT NULL 
  (maybe also add: where pagerank is above some threshold?)
- STEP 2: combine results of sql1 into one large raw data object oRatingsForward of format: [context][rater][ratee] = [score, confidence]
- STEP 3: process oRatingsForward into oRatings which is of format: [context][ratee][rater] = [score, confidence]
- feed oRatings into GrapeRank calculator

NOT YET COMPLETED

usage:
e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/grapeRank?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type RatingsReverse = {[key:string]:{[key:string]:string}}

const attenuationFactor = 0.65
const rigor = 0.65

let changeSquaredSum = 0
const calculation = (oScorecardsIn:Scorecards, aObservees:[], oRatingsReverse:RatingsReverse) => {
  const oScorecardsOut:Scorecards = JSON.parse(JSON.stringify(oScorecardsIn))
  changeSquaredSum = 0
  for (let g=0; g < aObservees.length; g++) {
    const oObserveeData:{id: string} = aObservees[g]
    const observeeId = oObserveeData.id
    const oReverseObserveeObject = oRatingsReverse[observeeId]
    const aRaters = Object.keys(oReverseObserveeObject)
    let weights = 0
    let products = 0
    for (let r=0; r < aRaters.length; r++) {
      const raterId = aRaters[r]
      const sRating = oReverseObserveeObject[raterId]
      let rating = 1
      let ratingConfidence = 0.05
      if (sRating == 'm') {
        rating = 0
        ratingConfidence = 0.1
      }
      const aRaterInfluence = oScorecardsIn[raterId][0]
      const weight = attenuationFactor * ratingConfidence * aRaterInfluence
      const product = weight * rating
      weights += weight 
      products += product
    }
    let average = 0
    if (weights) {
      average = products / weights
    }
    const confidence = convertInputToConfidence(weights,rigor)
    const influence = average * confidence
    oScorecardsOut[observeeId] = [influence, confidence, average, weights]
    if (oScorecardsIn[observeeId]) {
      const influenceChange = oScorecardsIn[observeeId][0] - influence
      const changeSquared = influenceChange * influenceChange
      changeSquaredSum += changeSquared
    }
    
  }
  return oScorecardsOut
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/grapeRank: pubkey was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const startingTimestamp = Math.floor(Date.now() / 1000)
    const observer = searchParams.pubkey
    if (typeof observer == 'string' && verifyPubkeyValidity(observer)) {
      try {
        const connection = await mysql.createConnection({
          host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
          port: 3306,
          user: process.env.AWS_MYSQL_USER,
          password: process.env.AWS_MYSQL_PWD,
          database: process.env.AWS_MYSQL_DB,
        });

        // STEP 1
        let observerId = -1

        const sql0 = `SELECT id, pubkey FROM users WHERE pubkey='${observer}'; `
        const results_sql0 = await connection.query(sql0);
        const aUsers0 = JSON.parse(JSON.stringify(results_sql0[0]))
        
        const oObserverData = aUsers0[0]
        observerId = oObserverData.id

        const sql1 = `SELECT id, reverseObserveeObject FROM users WHERE pubkey <> '${observer}' AND reverseObserveeObject IS NOT NULL; `
        const results_sql1 = await connection.query(sql1)
        console.log(typeof results_sql1)
        const aObservees = JSON.parse(JSON.stringify(results_sql1[0]))

        // STEP 2

        const oRatingsReverse:RatingsReverse = {}
        // oScorecards: oScorecards[rateeId] = average, confidence; probably also average and input; keep all in array for convenience
        // observer is logged in user; context is notSpam;
        let oScorecards:Scorecards = {} // influence, confidence, average, input
        
        // STEPs 3 and 4
        for (let x=0; x < aObservees.length; x++) {
          const oObserveeData = aObservees[x]
          const observeeId:number = oObserveeData.id
          const oReverseObserveeObject = oObserveeData.reverseObserveeObject
          oRatingsReverse[observeeId] = oReverseObserveeObject
          const aRaters = Object.keys(oReverseObserveeObject)
          for (let r=0; r < aRaters.length; r++) {
            const raterId = aRaters[r]
            oScorecards[raterId] = [0,0,0,0]
          }
        }
        // delete oRatingsReverse[observerId] // this ensures the scorecard of the seed user will not be overwritten in subsequent steps
        oScorecards[observerId] = [1,1,1,9999]

        // STEP 5
        // iterate through GrapeRank until max iterations or until convergence

        let continueIterating = true
        let numIterations = 0
        const aConvergenceTracker:{numIterations: number,changeSquaredSum: number}[] = []
        do {
          oScorecards = calculation(oScorecards, aObservees, oRatingsReverse)
          aConvergenceTracker.push({numIterations,changeSquaredSum})
          numIterations++
          if (numIterations > 12) {
            continueIterating = false
          }
          if (changeSquaredSum < 0.0001 ) { // not sure what 
            continueIterating = false
          }
          const currentTimestamp = Math.floor(Date.now() / 1000)
          if (currentTimestamp - startingTimestamp > 50) {
            continueIterating = false
          }
        } while (continueIterating)

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const reverseUsersChars = JSON.stringify(oRatingsReverse).length
        const oRatingsReverseSizeInMB = reverseUsersChars / 1048576

        const currentTimestamp = Math.floor(Date.now() / 1000)

        const grapeRankData:GrapeRank = {
          metaData: {
            whenLastUpdated: currentTimestamp,
            referencePubkey: observer, 
            aConvergenceTracker,
          },
          data: {
            scorecards: oScorecards,
          },
        }

        /* PutObjectCommand */
        const fooFxn = async (grapeRankData:GrapeRank) => {
          const sOutput = JSON.stringify(grapeRankData)
          return sOutput
        }

        const params_put = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${observer}/graperank`,
          Body: await fooFxn(grapeRankData)
        }

        const command_put = new PutObjectCommand(params_put);
        const response_put = await client.send(command_put);

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/algos/grapeRank data`,
          data: {
            aConvergenceTracker,
            observerId,
            referencePubkey: observer,
            numObserveeObjects: aObservees.length,
            oRatingsReverseSizeInMB,
            response_put,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/grapeRank error: ${error}`,
          data: {
            observer,
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/algos/grapeRank: one or both of the provided pubkeys is invalid`,
        data: {
          observer
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/grapeRank: pubkey was not provided`
    }
    res.status(500).json(response)
  }
}