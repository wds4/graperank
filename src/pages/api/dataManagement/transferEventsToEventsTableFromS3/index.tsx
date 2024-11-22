import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'
import { makeEventSerializable } from '@/helpers'

/*
usage:

http://localhost:3000/api/dataManagement/transferEventsToEventsTableFromS3?n=3

https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=3

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

const serializeEvent = async (event:NostrEvent) => {
  const oOutput = makeEventSerializable(event)
  const sOutput = JSON.stringify(oOutput)
  return sOutput
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

  try {
    // fetch events that have been processed
    const params1 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Prefix: 'eventsByEventId',
    }
    const command1 = new ListObjectsCommand(params1);
    const data1 = await client.send(command1);

    // fetch events that have not yet been processed
    const params2 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Prefix: 'recentlyAddedEventsByEventId',
    }
    const command2 = new ListObjectsCommand(params2);
    const data2 = await client.send(command2);

    const aProcessedEventIds = []
    
    if (data1.Contents) {
      const numEvents = data1.Contents.length
      for (let x=0; x < numEvents; x++) {
        const oNextEventContent = data1.Contents[x]
        if (oNextEventContent.Key && typeof oNextEventContent.Key == 'string') {
          const nextEventId = oNextEventContent.Key.substring(16)
          if (nextEventId) {
            aProcessedEventIds.push(nextEventId)
          }
        }
      }
    }

    const aUnprocessedEventIds:string[] = []
    const aDuplicatedEventIds:string[] = []
    if (data2.Contents) {
      const numEvents = data2.Contents.length
      for (let x=0; x < numEvents; x++) {
        const oNextEventContent = data2.Contents[x]
        if (oNextEventContent.Key && typeof oNextEventContent.Key == 'string') {
          const nextEventId = oNextEventContent.Key.substring(29)
          if (!aProcessedEventIds.includes(nextEventId)) {
            // need to process event
            aUnprocessedEventIds.push(nextEventId)
          } else {
            // no need to process, but need to delete from recentlyAddedEventsByEventId/ s3 bucket
            aDuplicatedEventIds.push(nextEventId)
          }
        }
      }
    }

    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });

    const aEvents = []
    const aCommands = []

    for (let n=0; n < Math.min(aUnprocessedEventIds.length, numEventsToProcess); n++) {
      const eventId = aUnprocessedEventIds[n]
      const params = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: 'recentlyAddedEventsByEventId/' + eventId,
      }
      const command = new GetObjectCommand(params);
      const data = await client.send(command);
      const sEvent = await data.Body?.transformToString()

      if (typeof sEvent == 'string') {
        const event:NostrEvent = JSON.parse(sEvent) 
        const isEventValid = validateEvent(event)
        if (isEventValid) {
          aEvents.push(event)
          
          // sql: add event to events table
          const command_sql = ` INSERT IGNORE INTO events (pubkey, eventid, created_at, kind) VALUES ( '${event.pubkey}', '${event.id}', ${event.created_at}, ${event.kind} ); `
          aCommands.push(command_sql)
          const results1 = await connection.query(command_sql);
          console.log(results1);

          // s3 PutObjectCommand: add event to eventsByEventId
          const params_put = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: 'eventsByEventId/' + event.id,
            Body: await serializeEvent(event),
          }
          const command_s3_put = new PutObjectCommand(params_put);
          const data_put = await client.send(command_s3_put);
          console.log(`===== data: ${JSON.stringify(data_put)}`)

          // s3 DeleteObjectCommand: delete event from recentlyAddedEventsByEventId
          const params_delete = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: 'recentlyAddedEventsByEventId/' + event.id,
          }
          const command_s3_delete = new DeleteObjectCommand(params_delete);
          const data_delete = await client.send(command_s3_delete);
          console.log(`===== data: ${JSON.stringify(data_delete)}`)
        }
      }
    }

    // duplicated events need to be removed from recentlyAddedEventsByEventId but have already been processed (are already in eventsByEventId)
    for (let n=0; n < aDuplicatedEventIds.length; n++) {
      const eventId = aDuplicatedEventIds[n]
      // s3 DeleteObjectCommand: delete event from recentlyAddedEventsByEventId
      const params_delete = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: 'recentlyAddedEventsByEventId/' + eventId,
      }
      const command_s3_delete = new DeleteObjectCommand(params_delete);
      const data_delete = await client.send(command_s3_delete);
      console.log(`===== data: ${JSON.stringify(data_delete)}`)
    }
    
    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/transferEventsToEventsTableFromS3 data:`,
      data: { 
        numEventsToProcess,
        numProcessedEvents: aProcessedEventIds.length,
        numUnprocessedEvents: aUnprocessedEventIds.length,
        numDuplicatedEvents: aDuplicatedEventIds.length,
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