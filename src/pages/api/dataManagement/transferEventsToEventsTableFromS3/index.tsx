import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
// import { validateEvent } from 'nostr-tools'
// import { NostrEvent } from "@nostr-dev-kit/ndk"
// import mysql from 'mysql2/promise'

/*
usage:

http://localhost:3000/api/dataManagement/transferEventsToEventsTableFromS3?n=1

https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=1

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
  if (searchParams.n && typeof searchParams.n == 'number') {
    numEventsToProcess = searchParams.n
  }
  console.log(`numEventsToProcess: ${numEventsToProcess}`)

  try {
    // fetch events that have not yet been processed
    const params1 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Prefix: 'unprocessedEventsByEventId',
    }
    const command1 = new ListObjectsCommand(params1);
    const data1 = await client.send(command1);

    // fetch events that have been processed
    const params2 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Prefix: 'eventsByEventId',
    }
    const command2 = new ListObjectsCommand(params2);
    const data2 = await client.send(command2);

    /*
    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });

    for (let n=0; n < Math.min(numEventsToProcess, 5); n++) {
      const params = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: 'eventsByEventId/' + eventId,
      }
      const command = new GetObjectCommand(params);
      const data = await client.send(command);
      const sEvent = await data.Body?.transformToString()

      let oEvent = ''
      if (typeof sEvent == 'string') {
        oEvent = JSON.parse(sEvent) 
      }

      const isEventValid = validateEvent(oEvent)

      const command_sql = ` INSERT IGNORE INTO events (pubkey, eventid, created_at, kind) VALUES ( '${event.id}', '${event.pubkey}', ${event.created_at}, ${event.kind} ); `
      const results1 = await connection.query(command_sql);
      console.log(results1);
    }
    */

    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/transferEventsToEventsTableFromS3 data:`,
      data: { 
        data1, data2
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/transferEventsToEventsTableFromS3 error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}