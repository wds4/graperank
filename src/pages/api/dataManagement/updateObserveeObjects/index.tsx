import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
// import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'
import { isValidPubkey } from '@/helpers/nip19'
import { SqlIdsByPubkey } from '@/types'

/*
- sql1: SELECT id, pubkey, kind3EventId, kind10000EventId FROM users WHERE ((kind3EventId IS NOT NULL) OR (kind10000EventId IS NOT NULL)) AND ((flaggedToUpdateObserveeObject=1) OR (observeeObject IS NULL))
- for each row:
  - define userId, userPubkey, kind3EventId, kind10000EventId
  - get kind3Event and kind10000Event from s3 using keys: eventsByEventId/<kind3EventId> and eventsByEventId/<kind10000EventId>
  - create observeeObject using kind3Event and kind10000Event
  - sql2: UPDATE users SET observeeObject=observeeObject, flaggedToUpdateObserveeObject=0 where 

usage:

http://localhost:3000/api/dataManagement/updateObserveeObjects?n=1

https://www.graperank.tech/api/dataManagement/updateObserveeObjects?n=1

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  let numRowsToProcess = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    numRowsToProcess = Number(searchParams.n)
  }
  console.log(`numRowsToProcess: ${numRowsToProcess}`)
  try {
    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });

    const sql1 = ` SELECT id, pubkey, kind3EventId, kind10000EventId FROM users WHERE ((kind3EventId IS NOT NULL) OR (kind10000EventId IS NOT NULL)) AND ((flaggedToUpdateObserveeObject=1) OR (observeeObject IS NULL)) LIMIT ${numRowsToProcess}`
    const results_sql1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results_sql1[0]))
    
    const aOutput = []

    const params_get3 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: 'dataManagement/lookupSqlIdsByPubkey',
    }
    const command_s3_get3 = new GetObjectCommand(params_get3);
    const data_get3 = await client.send(command_s3_get3);
    const sLookupSqlIdsByPubkey = await data_get3.Body?.transformToString()

    if (typeof sLookupSqlIdsByPubkey == 'string') {
      const oLookupSqlIdsByPubkey:SqlIdsByPubkey = JSON.parse(sLookupSqlIdsByPubkey)
      for (let x=0; x < aUsers.length; x++) {
        const oObserveeObject:{[key:string | number]: string} = {}
        let numFollows = 0
        let numMutes = 0
        const oNextUser = aUsers[x]
        // const userId = oNextUser.id
        const pubkey_parent = oNextUser.pubkey
        const kind3EventId = oNextUser.kind3EventId
        const kind10000EventId = oNextUser.kind10000EventId

        if (kind3EventId) {
          const params_get1 = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: 'eventsByEventId/' + kind3EventId,
          }
          const command_s3_get1 = new GetObjectCommand(params_get1);
          const data_get1 = await client.send(command_s3_get1);
          const sKind3Event = await data_get1.Body?.transformToString()
          if (typeof sKind3Event == 'string') { 
            const oKind3Event:NostrEvent = JSON.parse(sKind3Event)
            // FOLLOWS
            const aKind3Tags = oKind3Event.tags
            for (let x=0; x < aKind3Tags.length; x++) {
              const aTag = aKind3Tags[x]
              if (aTag[0] == 'p') {
                const pk = aTag[1]
                if (isValidPubkey(pk) && (pk != pubkey_parent)) {
                  let userKey:string | number = pk
                  if (oLookupSqlIdsByPubkey[pk]) {
                    userKey = oLookupSqlIdsByPubkey[pk]
                  }
                  oObserveeObject[userKey] = 'f'
                  numFollows++
                }
              }
            }
          }
        }

        if (kind10000EventId) {
          const params_get2 = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: 'eventsByEventId/' + kind10000EventId,
          }
          const command_s3_get2 = new GetObjectCommand(params_get2);
          const data_get2 = await client.send(command_s3_get2);
          const sKind10000Event = await data_get2.Body?.transformToString()
          if (typeof sKind10000Event == 'string') { 
            const oKind10000Event:NostrEvent = JSON.parse(sKind10000Event)
            // MUTES
            const aKind310000Tags = oKind10000Event.tags
            for (let x=0; x < aKind310000Tags.length; x++) {
              const aTag = aKind310000Tags[x]
              if (aTag[0] == 'p') {
                const pk = aTag[1]
                if (isValidPubkey(pk) && (pk != pubkey_parent)) {
                  let userKey:string | number = pk
                  if (oLookupSqlIdsByPubkey[pk]) {
                    userKey = oLookupSqlIdsByPubkey[pk]
                  }
                  oObserveeObject[userKey] = 'm'
                  numMutes++
                }
              }
            }
          }
        }

        aOutput.push({ numFollows, numMutes })

        const sObserveeObject = JSON.stringify(oObserveeObject)
        // cleaning up 
        const sql2= ` UPDATE users SET observeeObject='${sObserveeObject}', flaggedToUpdateObserveeObject=0 WHERE pubkey='${pubkey_parent}' `
        // aOutput.push(sql2)
        const results_sql2 = await connection.query(sql2);
        console.log(typeof results_sql2)
        aOutput.push({results_sql2})
        // aOutput.push(oObserveeObject)
      }
    }

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    
    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/updateObserveeObjects data:`,
      data: {
        aUsers,
        aOutput
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/updateObserveeObjects error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}