import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { write } from '@/lib/neo4j'

/*
- select * from users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 (wait until parent node is properly updated)
for each row:
  - get const pubkey_parent, const kind3EventId
  - get aFutureFollows, all FUTURE follows from kind3Event
  - get aOldFollows, all CURRENT follows in neo4j of pubkey_parent (every node pubkey_parent currently follows)
    cypher0:
  - compare aFutureFollows and aOldFollows to determine which pubkeys must be followed and which unfollowed, and for them set flaggedToUpdateReverseObserveeObject=1 in sql users
  - cypher1: access https://graperank.tech/api/neo4j/generateCsv/fromSingleKind3EventId?kind3EventId=... and execute via csv import

  // TODO: anything else need doing right here ????

  // cleaning up
  - sql2: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent

usage:

https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsByCsv?n=1

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
    const sql1 = ` SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    const aResults = []
    for (let x=0; x < Math.min(numUsersToProcess, aUsers.length); x++) {
      const oNextUser = aUsers[x]
      const kind3EventId = oNextUser.kind3EventId
      const pubkey_parent = oNextUser.pubkey.toLowerCase()
      // TODO: ? verify kind3EventId is valid
      const cypher1 = `LOAD CSV FROM 'https://graperank.tech/api/neo4j/generateCsv/fromSingleKind3EventId?kind3EventId=${kind3EventId}'
      AS row
      MERGE (n:NostrUser {pubkey: row[1]})
      MERGE (m:NostrUser {pubkey: row[2]})
      MERGE (n)-[:FOLLOWS]->(m)
      `
      const cypher1_result = await write(cypher1, {})
      console.log(`result: ${JSON.stringify(cypher1_result)}`)
      aResults.push({x, pubkey_parent, kind3EventId, cypher1, cypher1_result})

      // cleaning up 
      const sql2 = ` UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey='${pubkey_parent}' `
      const sql2_results = await connection.query(sql2);
      console.log(sql2_results)
    }

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    
    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/updateNeo4jFollowsByCsv data:`,
      data: {
        numUsersToProcess,
        aResults,
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateNeo4jFollowsByCsv error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}