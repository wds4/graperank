import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
// import { arrayToObject } from '@/helpers';

/*
usage:
https://www.graperank.tech/api/sql/fetchPubkeysBySqlId

returns an object used to fetch a user pubkey given the userID from the table: users

Useful since several tables, including ratingsTables and scorecardsTables, use userID rather than pubkey to refer to users 
*/

type ResponseData = {
  success: boolean,
  message: string,
  data?: object
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });
    const command1 = `SELECT id, pubkey FROM users; `
    const results1 = await connection.query(command1);
    const aResults1 = JSON.parse(JSON.stringify(results1[0]))
  
    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    const oPubkeysBySqlId:{[key: number]: string} = {}
    for (let x=0; x < aResults1.length; x++) {
      const oNextUser = aResults1[x]
      const id = oNextUser.id
      const pk = oNextUser.pubkey
      oPubkeysBySqlId[id] = pk
    }

    const resultUsersChars = JSON.stringify(aResults1).length
    const megabyteSize = resultUsersChars / 1048576

    const response: ResponseData = {
      success: true,
      message: 'Results of your fetchPubkeysBySqlId query:',
      data: {
        numRows: aResults1.length,
        megabyteSize,
        oPubkeysBySqlId
      }
    }
    res.status(200).json(response)
  } catch (e) {
    console.log(e)
  }
}
