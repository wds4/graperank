import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { GrapeRank, ResponseData, Scorecards } from '@/types'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { convertInputToConfidence } from '@/helpers/grapevine'

/*
Calculate GrapeRank scores for all pubkeys 

The following steps must be taken (using api/dataManagement/users/updateReverseObserveeObjects) prior to this (api/algos/grapeRank) endpoint:
1. use neo4j to create reverseObserveeObject for each user (one at a time) and store in sql
2. update reverseObserveeObject (currently records ratings using 'f' or 'm'; MIGHT change to [1, 0.05] vs [0, 0.1]) for a user each time a rating is added or deleted, using flag to id user

- STEP 1: 
  sql0: SELECTE id, pubkey FROM users WHERE pubkey='${observer}'
  sql1: SELECT id, reverseObserveeObject FROM users WHERE pubkey <> '${observer}' AND reverseObserveeObject IS NULL NOT NULL 

- STEP 2: combine results of sql1 into one large raw data object oRatingsReverse of format: [context][ratee][rater] = [score, confidence]

- STEP 3: intialize oScorecards

- STEP 4: iterate through GrapeRank until max iterations or until convergence

- STEP 5: create grapeRankData and store in S3

- STEP 6: sql2: UPDATE customers SET grapeRankParams='${grapeRankParams}' WHERE pubkey='${pubkey}'

usage:
e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/grapeRank?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

https://www.graperank.tech/api/algos/grapeRank?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&attenuationFactor=0.9

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type RatingsReverse = {[key:string]:{[key:string]:string}}

type GrapeRankParams = {
  attenuationFactor: number,
  rigor: number,
  muteRating: number,
  muteConfidence: number,
  followRating: number,
  followConfidence: number,
  followConfidenceOfObserver: number,
}

const attenuationFactor_default = 0.85
const rigor_default = 0.55
const muteRating_default = -0.5
const muteConfidence_default = 0.75
const followRating_default = 1
const followConfidence_default = 0.05
const followConfidenceOfObserver_default = 0.2

let changeSquaredSum = 0
const calculation = (gParams:GrapeRankParams, oScorecardsIn:Scorecards, aObservees:[], oRatingsReverse:RatingsReverse, observerId:string) => {
  const {attenuationFactor, rigor, muteRating, muteConfidence, followRating, followConfidence, followConfidenceOfObserver} = gParams
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
      
      const raterInfluence = oScorecardsIn[raterId][0]

      let rating = muteRating
      let ratingConfidence = muteConfidence
      if (sRating == 'f') {
        rating = followRating
        ratingConfidence = followConfidence
        if (observerId == raterId) {
          ratingConfidence = followConfidenceOfObserver
        }
      }
      let weight = attenuationFactor * ratingConfidence * raterInfluence
      if (observerId == raterId) { // remove attenuationFactor
        weight = ratingConfidence * raterInfluence
      }
      const product = weight * rating
      weights += weight 
      products += product
    }
    let average = 0
    if (weights) {
      average = products / weights
    }
    const confidence = convertInputToConfidence(weights,rigor)
    let influence = average * confidence
    if (influence < 0) {
      influence = 0
    }
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
  const gParams:GrapeRankParams = {
    attenuationFactor: attenuationFactor_default,
    rigor: rigor_default,
    muteRating: muteRating_default,
    muteConfidence: muteConfidence_default,
    followRating: followRating_default,
    followConfidence: followConfidence_default,
    followConfidenceOfObserver: followConfidenceOfObserver_default,
  }
  if (searchParams.attenuationFactor && typeof searchParams.attenuationFactor == 'string') {
    gParams.attenuationFactor = Number(searchParams.attenuationFactor )
  }
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
        const sObserverId = JSON.stringify(observerId)

        const sql1 = `SELECT id, reverseObserveeObject FROM users WHERE pubkey <> '${observer}' AND reverseObserveeObject IS NOT NULL; `
        const results_sql1 = await connection.query(sql1)
        console.log(typeof results_sql1)
        const aObservees = JSON.parse(JSON.stringify(results_sql1[0]))

        // STEPs 2 and 3

        const oRatingsReverse:RatingsReverse = {}
        // oScorecards: oScorecards[rateeId] = average, confidence; probably also average and input; keep all in array for convenience
        // observer and context are not explicitly stated, bc observer is logged in user; context is "notSpam"
        let oScorecards:Scorecards = {} // influence, confidence, average, input
        
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

        // STEP 4
        // iterate through GrapeRank until max iterations or until convergence

        let continueIterating = true
        let numIterations = 0
        const aConvergenceTracker:{numIterations: number,changeSquaredSum: number}[] = []
        do {
          oScorecards = calculation(gParams, oScorecards, aObservees, oRatingsReverse, sObserverId)
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

        const currentTimestamp = Math.floor(Date.now() / 1000)

        const grapeRankParams = {
          whenLastImplemented: currentTimestamp,
          paramsAtLastImplementation: gParams,
        }

        const sGrapeRankParams = JSON.stringify(grapeRankParams)

        const sql2 = `UPDATE customers SET grapeRankParams='${sGrapeRankParams}' WHERE pubkey='${observer}'; `
        const results_sql2 = await connection.query(sql2);
        console.log(typeof results_sql2)

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const reverseUsersChars = JSON.stringify(oRatingsReverse).length
        const oRatingsReverseSizeInMB = reverseUsersChars / 1048576

        const grapeRankData:GrapeRank = {
          metaData: {
            whenLastUpdated: currentTimestamp,
            referencePubkey: observer,
            parameters: grapeRankParams,
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
            grapeRankParams,
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