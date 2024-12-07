import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { ResponseData } from '@/types'

/*

Calculate PageRank scores for all pubkeys 
- sql1: SELECT id, pubkey, observeeObject FROM users WHERE observeeObject IS NULL NOT NULL 
  (maybe also add: where pagerank is above some threshold?)
- STEP 2: combine results of sql1 into one large raw data object oRatingsForward of format: [context][rater][ratee] = [score, confidence]
- STEP 3: process oRatingsForward into oRatings which is of format: [context][ratee][rater] = [score, confidence]
- feed oRatings into GrapeRank calculator

NOT YET COMPLETED

usage:
e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/grapeRank?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

const attenuationFactor = 0.85
const muteScore = 0
const followScore = 1
const muteConfidence = 0.1
const followConfidence = 0.05
const rigor = 0.25

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
  
        const sql0 = `SELECT id, pubkey, observeeObject FROM users WHERE observeeObject IS NOT NULL; `
        const results_sql0 = await connection.query(sql0);
        const aUsers0 = JSON.parse(JSON.stringify(results_sql0[0]))

        // STEP 2
        // const oRatingsReverse:ObserverObjectV0Compact = {}
        // const oRatingsForward:ObserverObjectV0Compact = {}
        // const oRatingsFoo:{[key:number]:string} = {}
        const oRatingsForward:{[key:number]:object} = {}
        const oRatingsReverse:{[key:number]:object} = {}
        for (let x=0; x < Math.min(aUsers0.length,5); x++) {
          const oUserData = aUsers0[x]
          const sObserveeObject:string = oUserData.observeeObject
          const raterId:number = oUserData.id
          oRatingsForward[raterId] = JSON.parse(sObserveeObject)
        }




        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/algos/grapeRank data:`,
          data: {
            grapeRank: {
              attenuationFactor,
              muteScore,
              followScore,
              muteConfidence,
              followConfidence,
              rigor,
            },
            referencePubkey: observer, 
            numObserveeObjects: aUsers0.length,
            oRatingsForward,
            oRatingsReverse,
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