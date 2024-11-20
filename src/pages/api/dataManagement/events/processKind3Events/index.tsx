import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
// import { validateEvent } from 'nostr-tools'
// import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'

/*
- sql1: select kind3EventId_new from events where kind=3 and flaggedForProcessing=1
- for each row:
  (_new refers to the event in events being processed; _old refers to the event previously processed which may or may not be replaced)
  - define pubkey, kind3EventId_new, created_at_new
  - sql2: select kind3EventId_old from users where pubkey=pubkey;
  - get event_old and event_new from s3 using keys: eventsByEventId/<kind3EventId_old> and eventsByEventId/<kind3EventId_new>
  - extract created_at_old and created_at_new from their respective events
  - if created_at_new > created_at_old, then:
    - sql3: update users set kind3eventId, flaggedForKind3EventProcessing=1 where pubkey;
  cleaning up:
  - sql4: update events set flaggedForProcessing=0 where eventId=kind3EventId_new
usage:

http://localhost:3000/api/dataManagement/events/processKind3Events?n=1

https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1

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
  let numEventsToProcess = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    numEventsToProcess = Number(searchParams.n)
  }
  console.log(`numEventsToProcess: ${numEventsToProcess}`)

  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const sql1 = ` SELECT * FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql1 = await connection.query(sql1);
    const aEvents = JSON.parse(JSON.stringify(results_sql1[0]))
    
    const debuggingLog = []
    for (let x=0; x < Math.min(numEventsToProcess, aEvents.length); x++) {
      const created_at_old = 0
      const oNextEvent = aEvents[x]
      const pubkey = oNextEvent.pubkey
      const created_at_new = oNextEvent.created_at
      // const kind3EventId_new = oNextEvent.eventId
      const sql2= ` SELECT * FROM users where pubkey='${pubkey}' `
      const results_sql2 = await connection.query(sql2);
      const aUsers = JSON.parse(JSON.stringify(results_sql2[0]))
      debuggingLog.push({aUsers, results_sql2, created_at_old, created_at_new, oNextEvent})
      console.log(aUsers.length)

      if (aUsers.length == 1) {
        const oUserData = aUsers[0]
        const kind3EventId_old = oUserData.kind3EventId
        if (kind3EventId_old) {
          // get event_old, then created_at_old
          const params_get = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: 'eventsByEventId/' + kind3EventId_old,
          }
          const command_s3_get = new GetObjectCommand(params_get);
          const data_get = await client.send(command_s3_get);
          console.log(data_get)
          /*
          const sEvent = await data_get.Body?.transformToString()
          console.log(`===== data: ${JSON.stringify(data_get)}`)
          if (typeof sEvent == 'string') {
            const event_old:NostrEvent = JSON.parse(sEvent) 
            const isEventValid = validateEvent(event_old)
            if (isEventValid) {
              created_at_old = event_old.created_at
            }
          }
            */
        }
      }
      /*
      
      if (created_at_new > created_at_old) {
        // This triggers the next step, which is to transfer follows into the users table
        const sql3= ` UPDATE users SET kind3eventId='${kind3EventId_new}', flaggedForKind3EventProcessing=1 WHERE pubkey='${pubkey}' `
        const results_sql3 = await connection.query(sql3);
        console.log(results_sql3)
      }

      // cleaning up 
      const sql4= ` UPDATE events SET flaggedForProcessing=0 WHERE eventId='${kind3EventId_new}' `
      const results_sql4 = await connection.query(sql4);
      console.log(results_sql4)

      */
    }
    
    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/events/processKind3Events data:`,
      data: { 
        debuggingLog,  aEvents, results_sql1
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/events/processKind3Events error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}