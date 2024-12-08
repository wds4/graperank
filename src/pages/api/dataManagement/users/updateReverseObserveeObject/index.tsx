import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types';

/*
- sql1: select * from users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL LIMIT ${numUsersToProcess}
for each row:
  - get const pubkey_parent
  - cypher1, cypher2: get follows and mutes of pubkey_parent
  - create reverseObserveeObject from follows and mutes
  - sql2: UPDATE users SET reverseObserveeObject='${sReverseObserveeObject}' WHERE pubkey=pubkey_parent

  // cleaning up
  - if success in above steps, then:
    sql3: UPDATE users SET flaggedToUpdateReverseObserveeObject=0 WHERE pubkey=pubkey_parent
    (probably can merge sql2 and sql3)

usage:

http://localhost:3000/api/dataManagement/users/updateReverseObserveeObject?n=1

https://www.graperank.tech/api/dataManagement/users/updateReverseObserveeObject?n=1

TODO: get kind0 note from s3 if available and add user data to neo4j node 

*/
 
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

  type PubkeyObj = { sqluserid: string }

  try {
    const sql1 = ` SELECT id, pubkey FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL LIMIT ${numUsersToProcess} `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    const aCypherResults = []

    for (let x=0; x < Math.min(numUsersToProcess, aUsers.length); x++) {
      const oNextUser = aUsers[x]
      const pubkey_parent = oNextUser.pubkey
      
      aCypherResults.push(pubkey_parent)

      const cypher1 = `MATCH (n:NostrUser)-[:FOLLOWS]->(m:NostrUser {pubkey: '${pubkey_parent}'}) RETURN n.sqluserid AS sqluserid LIMIT 1000`
      const cypher2 = `MATCH (n:NostrUser)-[:MUTES]->(m:NostrUser {pubkey: '${pubkey_parent}'}) RETURN n.sqluserid AS sqluserid LIMIT 1000`
  
      aCypherResults.push(cypher1)
      aCypherResults.push(cypher2)

      const aFollows:PubkeyObj[] = await read(cypher1, {})
      const aMutes:PubkeyObj[] = await read(cypher2, {})

      // aCypherResults.push(aFollows)
      // aCypherResults.push(aMutes)
      const oReverseObserveeObject:{[key: string]: string} = {}
      for (let f=0; f < aFollows.length; f++) {
        const oFollow:PubkeyObj = aFollows[f]
        const sqluserid = oFollow.sqluserid
        oReverseObserveeObject[sqluserid]='f'
      }
      for (let m=0; m < aMutes.length; m++) {
        const oMute:PubkeyObj = aMutes[m]
        const sqluserid = oMute.sqluserid
        oReverseObserveeObject[sqluserid]='m'
      }
      aCypherResults.push(oReverseObserveeObject)


      /*
      const sql2 = ` UPDATE users SET reverseObserveeObject='${sReverseObserveeObject}' WHERE pubkey='${pubkey_parent}' `
      const results2 = await connection.query(sql2);
      console.log(results2)
      */

      // cleaning up 
      /*
      const sql3 = ` UPDATE users SET flaggedToUpdateReverseObserveeObject=0 WHERE pubkey='${pubkey_parent}' `
      const results3 = await connection.query(sql3);
      console.log(results3)
      */
    }

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    const response:ResponseData = {
      success: true,
      exists: true,
      message: `api/dataManagement/users/updateReverseObserveeObject data:`,
      data: { 
        numUsers: aUsers.length, aCypherResults
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateReverseObserveeObject error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}