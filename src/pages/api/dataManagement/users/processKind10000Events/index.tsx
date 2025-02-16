import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'
import { isValidPubkey } from '@/helpers/nip19'

/*
- sql1: select * from users where flaggedForKind10000EventProcessing=1
for each pubkey_parent:
  - get pubkey_parent, kind10000EventId
  - get kind10000Event from s3 using kind10000EventId
  - cycle through each pubkey_child in kind10000Event:
    - const pubkey_child
    - sql3: INSERT IGNORE INTO users (pubkey, flaggedToUpdateNeo4jNode) VALUES (pubkey_child, 1)
      (if already present, do nothing, including no need to set flaggedToUpdateNeo4jNode=1)
  // cleaning up
  - sql4: UPDATE users SET flaggedForKind10000EventProcessing = 0 WHERE pubkey=pubkey_parent
  - merge sql2 into sql4: UPDATE users SET flaggedToUpdateNeo4jMutes=1 WHERE pubkey=pubkey_parent

http://localhost:3000/api/dataManagement/users/processKind10000Events?n=10

https://www.graperank.tech/api/dataManagement/users/processKind10000Events?n=10

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
  let numUsersToProcess = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    numUsersToProcess = Number(searchParams.n)
  }
  console.log(`numUsersToProcess: ${numUsersToProcess}`)

  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const sql1 = ` SELECT * FROM users where flaggedForKind10000EventProcessing=1 `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    const aPubkeysDiscovered = []
    for (let x=0; x < Math.min(numUsersToProcess, aUsers.length); x++) {
      const oNextUser = aUsers[x]
      const pubkey_parent = oNextUser.pubkey
      const kind10000EventId = oNextUser.kind10000EventId

      if (kind10000EventId) {
        const params_get = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'eventsByEventId/' + kind10000EventId,
        }
        const command_s3_get = new GetObjectCommand(params_get);
        const data_get = await client.send(command_s3_get);
        console.log(data_get)
        const sEvent = await data_get.Body?.transformToString()
        if (typeof sEvent == 'string') {
          const oKind10000Event:NostrEvent = JSON.parse(sEvent) 
          const isEventValid = validateEvent(oKind10000Event)
          if (isEventValid) {
            const aTags = oKind10000Event.tags
            for (let t=0; t < aTags.length; t++) {
              const aTag = aTags[t]
              if (aTag && aTag[0] == 'p' && aTag[1] && isValidPubkey(aTag[1])) {
                const pubkey_child = aTag[1].toLowerCase()
                console.log(pubkey_child)
                aPubkeysDiscovered.push(pubkey_child)
                const sql3 = ` INSERT IGNORE INTO users (pubkey, flaggedToUpdateNeo4jNode) VALUES ('${pubkey_child}', 1) `
                const results3 = await connection.query(sql3);
                console.log(results3)
              }
            }
          }
        }
      }

      // cleaning up 
      const sql4 = ` UPDATE users SET flaggedToUpdateNeo4jMutes=1, flaggedForKind10000EventProcessing=0, flaggedToUpdateObserveeObject=1 WHERE pubkey='${pubkey_parent}' `
      const results4 = await connection.query(sql4);
      console.log(results4)
    }

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    
    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/processKind10000Events data:`,
      data: { 
        numUsersNeedingKind10000EventProcessing: aUsers.length,
        numPubkeysDiscovered: aPubkeysDiscovered.length,
        aPubkeysDiscovered,
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/processKind10000Events error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}