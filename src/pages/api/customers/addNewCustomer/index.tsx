import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/customers/addNewCustomer?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

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
      success: false,
      message: `api/customers/addNewCustomer: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      // add new customer to sql database
      const currentTimestamp = Math.floor(Date.now() / 1000)
      const command0 = ` SELECT count(id) AS countid FROM customers WHERE pubkey='${pubkey1}' `
      const command1 = ` INSERT IGNORE INTO customers (pubkey, whenSignedUp) VALUES ( '${pubkey1}', ${currentTimestamp} ); `
      try {
        const connection = await mysql.createConnection({
          host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
          port: 3306,
          user: process.env.AWS_MYSQL_USER,
          password: process.env.AWS_MYSQL_PWD,
          database: process.env.AWS_MYSQL_DB,
        });

        const results0 = await connection.query(command0);
        const oResults0 = JSON.parse(JSON.stringify(results0))

        const countId = oResults0[0][0].countid

        let alreadyCustomer = true 
        let results1 = {}
        if (countId == 0) {
          alreadyCustomer = false
          results1 = await connection.query(command1);
          console.log(results1);
        }

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        const response:ResponseData = {
          success: true,
          message: `api/customers/addNewCustomer data:`,
          data: {
            alreadyCustomer,
            command0,
            results0,
            command1,
            results1
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/customers/addNewCustomer error: ${error}`,
          data: {
            command1
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/customers/addNewCustomer: the provided pubkey is invalid`
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/customers/addNewCustomer: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}