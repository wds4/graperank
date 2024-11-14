import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/sql/transferSingleEventToEventsTableFromS3?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

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
  if (!searchParams.eventid) {
    const response:ResponseData = {
      success: false,
      message: `api/sql/transferSingleEventToEventsTableFromS3: no eventid was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.eventid) {
    const eventId = searchParams.eventid
    if (typeof eventId == 'string') {
      try {
        const connection = await mysql.createConnection({
          host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
          port: 3306,
          user: process.env.AWS_MYSQL_USER,
          password: process.env.AWS_MYSQL_PWD,
          database: process.env.AWS_MYSQL_DB,
        });

        const params = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'eventsByEventId/' + eventId,
        }
        const command = new GetObjectCommand(params);
        const data = await client.send(command);
        const sEvent = await data.Body?.transformToString()

        let oEvent = {}
        if (typeof sEvent == 'string') {
          oEvent = JSON.parse(sEvent) 
        }

        const isEventValid = validateEvent(oEvent)

        if (validateEvent(oEvent)) {
          /* insert event into sql table: events */
          const event:NostrEvent = oEvent
          const command = ` INSERT INTO events (pubkey, eventID, created_at, kind) VALUES ( '${event.id}', '${event.pubkey}', ${event.created_at}, ${event.kind} ); `
          const results = await connection.query(command);
          console.log(results);
          const response:ResponseData = {
            success: true,
            message: `api/sql/transferSingleEventToEventsTableFromS3 data:`,
            data: { 
              isEventValid,
              results,
              event: oEvent
            }
          }
          res.status(200).json(response)
        } else {
          const response:ResponseData = {
            success: false,
            message: `api/sql/transferSingleEventToEventsTableFromS3 error: the stored event is not valid`,
          }
          res.status(500).json(response)
        }
      } catch (error) {
        // error handling.
        console.log(`error: ${JSON.stringify(error)}`)
        const response:ResponseData = {
          success: false,
          message: `api/sql/transferSingleEventToEventsTableFromS3 error: ${error}!`,
        }
        res.status(500).json(response)
      } finally {
        // finally.
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/sql/transferSingleEventToEventsTableFromS3 error: the provided eventid is not valid`,
      }
      res.status(500).json(response)
    }
  }
}