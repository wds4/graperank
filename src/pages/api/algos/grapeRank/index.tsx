import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { ResponseData } from '@/types'

/*
This endpoint is likely to be deprecated or reworked in favor of:
1. use neo4j to create reverseObserveeObject for each user (one at a time) and store in sql
2. update reverseObserveeObject for a user each time a rating is added or deleted, using flag to id user

currently: 'f' or 'm'; MIGHT change to [1, 0.05] vs [0, 0.1]

Rework this endpoint; start this endpoint at step 3:
3. create reverseRatingsObject by aggregating each reverseObserveeObject on the fly; should take about 10 seconds
4. use reverseRatingsObject as input into 

- STEP 1: sql1: SELECT id, pubkey, reverseObserveeObject FROM users WHERE reverseObserveeObject IS NULL NOT NULL 
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

        // STEP 1
        const sql0 = `SELECT id, pubkey, reverseObserveeObject FROM users WHERE id < 20 AND reverseObserveeObject IS NOT NULL; `
        const results_sql0 = await connection.query(sql0);
        const aUsers0 = JSON.parse(JSON.stringify(results_sql0[0]))

        // STEP 2
        type RatingsReverse = {[key:string]:{[key:string]:string}}
        const oRatingsReverse:RatingsReverse = {}
        
        for (let x=0; x < aUsers0.length; x++) {
          const oUserData = aUsers0[x]
          const sReverseObserveeObject:string = oUserData.reverseObserveeObject
          const raterId:number = oUserData.id
          oRatingsReverse[raterId] = JSON.parse(sReverseObserveeObject)
        }
        




        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const reverseUsersChars = JSON.stringify(oRatingsReverse).length
        const oRatingsReverseSizeInMB = reverseUsersChars / 1048576

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/algos/grapeRank data:`,
          data: {
            results_sql0,
            aUsers0,
            referencePubkey: observer,
            numObserveeObjects: aUsers0.length,
            oRatingsReverseSizeInMB,
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