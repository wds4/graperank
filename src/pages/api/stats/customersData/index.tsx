import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/stats/customersOverview

page still being edited

*/

type ResponseData = {
  response?: object,
  success: boolean,
  exists?: boolean,
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
      success: false,
      message: `api/stats/customersOverview: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      // query customer table
      const command = ` SELECT * FROM customers WHERE pubkey='${pubkey1}' ;`
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
        const aCustomers = JSON.parse(JSON.stringify(results[0]))
        let exists = false
        if (aCustomers.length == 1) {
          exists = true
        }

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const response:ResponseData = {
          success: true,
          exists,
          message: `api/stats/customersOverview`,
          data: {
            command,
            oCustomerData: aCustomers[0],
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/stats/customersOverview error: ${error}`,
          data: {
            command,
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/stats/customersOverview: the provided pubkey is invalid`
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/stats/customersOverview: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}