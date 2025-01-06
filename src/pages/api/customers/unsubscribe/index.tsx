import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'
import { ResponseData } from '@/types'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/customers/unsubscribe?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/customers/unsubscribe: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      // remove customer from customer table in sql database
      const command = ` DELETE FROM customers WHERE pubkey='${pubkey1}' ;`
      try {
        const connection = await mysql.createConnection({
          host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
          port: 3306,
          user: process.env.AWS_MYSQL_USER,
          password: process.env.AWS_MYSQL_PWD,
          database: process.env.AWS_MYSQL_DB,
        });

        const results = await connection.query(command);
        console.log(results);

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        // s3 DeleteObjectCommand: delete customerData from recentlyAddedEventsByEventId
        const params_delete = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'customerData/' + pubkey1,
        }
        const command_s3_delete = new DeleteObjectCommand(params_delete);
        const data_delete = await client.send(command_s3_delete);
        console.log(typeof data_delete)

        const response:ResponseData = {
          success: true,
          message: `api/customers/unsubscribe data:`,
          data: {
            command,
            results
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/customers/unsubscribe error: ${error}`,
          data: {
            command
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/customers/unsubscribe: the provided pubkey is invalid`
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/customers/unsubscribe: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}