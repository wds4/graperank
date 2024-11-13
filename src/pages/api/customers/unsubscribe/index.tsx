import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

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
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: true,
      message: `api/customers/unsubscribe: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      // remove customer from customer table in sql database
      try {
        const connection = await mysql.createConnection({
          host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
          port: 3306,
          user: process.env.AWS_MYSQL_USER,
          password: process.env.AWS_MYSQL_PWD,
          database: process.env.AWS_MYSQL_DB,
        });

        const command = ` DELETE FROM customers 
WHERE pubkey=${pubkey1}
;`
        const results = await connection.query(command);
        console.log(results);

        const response:ResponseData = {
          success: true,
          message: `api/customers/unsubscribe data:`,
          data: {
            results
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/customers/unsubscribe error: ${error}`
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: true,
        message: `api/customers/unsubscribe: the provided pubkey is invalid`
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: true,
      message: `api/customers/unsubscribe: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}