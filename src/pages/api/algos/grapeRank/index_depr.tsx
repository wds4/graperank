import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { ResponseData } from '@/types'
import { isValidStringifiedObject } from '@/helpers'

/*
This endpoint is likely to be deprecated or reworked in favor of:
1. use neo4j to create reverseObserveeObject for each user (one at a time) and store in sql
2. update reverseObserveeObject for a user each time a rating is added or deleted, using flag to id user

currently: 'f' or 'm'; MIGHT change to [1, 0.05] vs [0, 0.1]

Rework this endpoint; start this endpoint at step 3:
3. create reverseRatingsObject by aggregating each reverseObserveeObject on the fly; should take about 10 seconds
4. use reverseRatingsObject as input into 

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
        // type RatingsReverse = {[key:string]:{[key:number]:[number,number]}}
        type RatingsReverse = {[key:string]:{[key:number]:string}}
        type RatingsForward = {[key:number]:object}
        const oRatingsForward:RatingsForward = {}
        const oRatingsReverse:RatingsReverse = {}
        // for (let x=0; x < Math.min(aUsers0.length,100); x++) {
        for (let x=0; x < aUsers0.length; x++) {
          const oUserData = aUsers0[x]
          const sObserveeObject:string = oUserData.observeeObject
          const raterId:number = oUserData.id
          if (isValidStringifiedObject(sObserveeObject)) {
            const oObserveeObject = JSON.parse(sObserveeObject)
            oRatingsForward[raterId] = oObserveeObject
            const aRatees = Object.keys(oObserveeObject)
            for (let y=0; y < Math.min(aRatees.length,10000); y++) {
              
              const ratee:string = aRatees[y]
              const rating:string = oObserveeObject[ratee]
              console.log(rating)

              if (!oRatingsReverse[ratee]) {
                oRatingsReverse[ratee] = {}
              }
              oRatingsReverse[ratee][raterId] = rating 
              /*
              // could do this format ...
              // if (rating == 'f') {
              //   oRatingsReverse[ratee][raterId] = [followScore, followConfidence]
              // }
              // if (rating == 'm') {
              //   oRatingsReverse[ratee][raterId] = [muteScore, muteConfidence]
              // }
              // ... OR this format: (rating equals 'f' or 'm')
              */
            }
          }
        }

        /* PutObjectCommand */
        const fooFxn = async (oRatingsReverse:RatingsForward) => {
          const sOutput = JSON.stringify(oRatingsReverse)
          return sOutput
        }

        const params_put = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${observer}/forwardRatingsTable`,
          Body: await fooFxn(oRatingsForward)
        }

        // const fooFxn = async (oRatingsReverse:RatingsReverse) => {
        //   const sOutput = JSON.stringify(oRatingsReverse)
        //   return sOutput
        // }

        // const params_put = {
        //   Bucket: 'grapevine-nostr-cache-bucket',
        //   Key: `customerData/${observer}/ratingsTable`,
        //   Body: await fooFxn(oRatingsReverse)
        // }

        const command_put = new PutObjectCommand(params_put);
        const response_put = await client.send(command_put);

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const reverseUsersChars = JSON.stringify(oRatingsReverse).length
        const oRatingsReverseSizeInMB = reverseUsersChars / 1048576

        const forwardUsersChars = JSON.stringify(oRatingsForward).length
        const oRatingsForwardSizeInMB = forwardUsersChars / 1048576

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
            oRatingsReverseSizeInMB,
            oRatingsForwardSizeInMB,
            response_put,
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