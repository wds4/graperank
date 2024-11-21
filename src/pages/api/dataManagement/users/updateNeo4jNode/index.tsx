import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { read } from '@/lib/neo4j'

/*
- sql1: select * from users where flaggedToUpdateNeo4jNode=1
for each row:
  - get const pubkey_parent
  - cypher1: add node for pubkey_parent if not already present
  // cleaning up
  - sql2: UPDATE users SET flaggedToUpdateNeo4jNode = 0 WHERE pubkey=pubkey_parent

usage:

http://localhost:3000/api/dataManagement/users/updateNeo4jNode?n=1

https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1

TODO: get kind0 note from s3 if available and add user data to neo4j node 

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
  let numUsersToProcess = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    numUsersToProcess = Number(searchParams.n)
  }
  console.log(`numUsersToProcess: ${numUsersToProcess}`)

  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const sql1 = ` SELECT * FROM users where flaggedToUpdateNeo4jNode=1 `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    const aCypherResults = []

    for (let x=0; x < Math.min(numUsersToProcess, aUsers.length); x++) {
      const oNextUser = aUsers[x]
      const pubkey_parent = oNextUser.pubkey

      // cypher1: add node pubkey_parent if not already exists
      const cypher1 = await read(`MERGE (hodlhodlhodl:NostrUser {pubkey: '${pubkey_parent}'}) RETURN ${pubkey_parent}.pubkey AS pubkey `, {})
      console.log(cypher1)
      aCypherResults.push({cypher1})

      /*
      // cleaning up 
      const sql2 = ` UPDATE users SET flaggedForKind3EventProcessing = 0 WHERE pubkey='${pubkey_parent}' `
      const results2 = await connection.query(sql2);
      console.log(results2)
      */
    }

    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/processKind3Events data:`,
      data: { 
        aUsers, aCypherResults
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/processKind3Events error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}