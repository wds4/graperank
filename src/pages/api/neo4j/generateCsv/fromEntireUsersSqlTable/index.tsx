import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
// import { write } from '@/lib/neo4j'

/*
Create csv of all users from sql table: users
include id and pubkey

purpose: update entire neo4j database with sqluserid for each node (pubkey is already present)

to access:

https://graperank.tech/api/neo4j/generateCsv/fromEntireUsersSqlTable


/*
const testCsv2 = `1,1,abcde12345
2,2,...
*/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });

    const sql1 = ` SELECT id, pubkey FROM users `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    let csvOutput = ''
    for (let x=0; x < aUsers.length; x++) {
      const oNextUser = aUsers[x]
      const sqluserid = oNextUser.id
      const pubkey_parent = oNextUser.pubkey
      csvOutput += `${x},${pubkey_parent},${sqluserid}\n`
    }

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    res.status(200).send(csvOutput)
  } catch (error) {
    const response = {
      success: false,
      message: `api/neo4j/generateCsv/fromEntireUsersSqlTable error: ${error}`,
    }
    res.status(500).json(response)
  }
}