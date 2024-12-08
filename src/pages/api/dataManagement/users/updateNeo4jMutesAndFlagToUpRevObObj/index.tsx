import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import mysql from 'mysql2/promise'
import { isValidPubkey } from '@/helpers/nip19'
import { read, write } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
- sql0: select id, pubkey, kind10000EventId from users where flaggedToUpdateNeo4jMutes=1 AND flaggedToUpdateNeo4jNode=0 LIMIT ${numUsersToProcess}
  (flaggedToUpdateNeo4jNode=0 so we wait until parent node is properly updated)
for each row:
  - get const pubkey_parent, const kind10000EventId
  - cypher0: calculate aCurrentMutes
  - s3_1: get kind10000Event using kind10000EventId
  - from kind10000Event, calculate aFutureMutes
  - from aFutureMutes and aCurrentMutes, calculate: aMutesToRemove and aMutesToAdd (in theory, should usually be just one change)
  -* cypher0b: add node for pubkey_parent if does not already exist (although in theory, it should already exist)
  - for each pk in aMutesToAdd:
    - get const pubkey_child
    -* cypher1: add node for pubkey_child if does not already exist
    -* cypher2: add edge MUTES from pubkey_parent to pubkey_child; include timestamp!
    - ???? sql1a_pre: INSERT IGNORE pubkey='${pubkey_child}' (TODO: need to add pubkey_child to sql table users if not already present ???) (maybe avoid since this will trigger AUTO_INCREMENT and row ought to be present already??)
    -* sql1a: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'
  - for each pk in aMutesToRemove:
    - get const pubkey_child
    -* cypher3: remove edge MUTES from pubkey_parent to pubkey_child
    -* sql1b: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'

  // cleaning up
  -* sqlc: UPDATE users SET flaggedToUpdateNeo4jMutes = 0 WHERE pubkey=pubkey_parent

usage:

https://www.graperank.tech/api/dataManagement/users/updateNeo4jMutesAndFlagToUpRevObObj?n=1

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
    const sql0 = ` SELECT id, pubkey, kind10000EventId FROM users where flaggedToUpdateNeo4jMutes=1 AND flaggedToUpdateNeo4jNode=0 LIMIT ${numUsersToProcess}`
    const results0 = await connection.query(sql0);
    const aUsers = JSON.parse(JSON.stringify(results0[0]))
    const aCypherResults = []
    for (let x=0; x < aUsers.length; x++) {
      const oNextUser = aUsers[x]
      // get const pubkey_parent, const kind10000EventId
      const pubkey_parent = oNextUser.pubkey
      const kind10000EventId = oNextUser.kind10000EventId

      // cypher0: calculate aCurrentMutes
      const cypher0 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'})-[:MUTES]->(m:NostrUser) RETURN m ` // cypher command 
      const result0 = await read(cypher0, {})
      const aCurrentMutes = []
      const aCurrentMutesData = JSON.parse(JSON.stringify(result0))
      for (let x=0; x < aCurrentMutesData.length; x++) {
        const oNextUserData = aCurrentMutesData[x]
        const pk = oNextUserData.m.properties.pubkey
        aCurrentMutes.push(pk)
      }

      // s3_1: get kind10000Event using kind10000EventId
      const params = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: 'eventsByEventId/' + kind10000EventId,
      }
      const command = new GetObjectCommand(params);
      const data = await client.send(command);
      const sKind10000Event = await data.Body?.transformToString()

      let oKind10000Event = {}
      if (typeof sKind10000Event == 'string') {
        oKind10000Event = JSON.parse(sKind10000Event) 
      }

      let created_at_newMutes = 0
      // from kind10000Event, calculate aFutureMutes
      const aFutureMutes = []
      if (validateEvent(oKind10000Event)) {
        created_at_newMutes = oKind10000Event.created_at
        const aTags = oKind10000Event.tags
        for (let t=0; t < aTags.length; t++) {
          const aTag = aTags[t]
          if (aTag && aTag[0] == 'p' && aTag[1] && isValidPubkey(aTag[1])) {
            const pubkey_child = aTag[1]
            aFutureMutes.push(pubkey_child)
          }
        }
      }

      // from aFutureMutes and aCurrentMutes, calculate: aMutesToRemove and aMutesToAdd (in theory, should usually be just one change)
      const aMutesToAdd:string[] = [] // in aFutureMutes but not in aCurrentMutes
      for (let z=0; z<aFutureMutes.length; z++) {
        const pk = aFutureMutes[z]
        if (!aCurrentMutes.includes(pk)) {
          aMutesToAdd.push(pk)
        }
      }
      const aMutesToRemove:string[] = [] // in aCurrentMutes but not in aFutureMutes
      for (let z=0; z<aCurrentMutes.length; z++) {
        const pk = aCurrentMutes[z]
        if (!aFutureMutes.includes(pk)) {
          aMutesToRemove.push(pk)
        }
      }

      // aCypherResults.push({pubkey_parent, created_at_newMutes, kind10000EventId, oKind10000Event, aCurrentMutes, aFutureMutes, aMutesToAdd, aMutesToRemove})
      aCypherResults.push({pubkey_parent, created_at_newMutes, kind10000EventId, aMutesToAdd, aMutesToRemove})

      // cypher0b: add node for pubkey_parent if does not already exist (although in theory, it should already exist)
      const cypher0b = `MERGE (n:NostrUser {pubkey: '${pubkey_parent}'}) RETURN n.pubkey AS pubkey `
      const cypher0b_results = await write(cypher0b, {})
      console.log(typeof cypher0b_results)
      // aCypherResults.push({cypher0b, cypher0b_results})

      for (let z=0; z<aMutesToAdd.length; z++) {
        // get const pubkey_child
        const pubkey_child = aMutesToAdd[z]
        // cypher1: add node for pubkey_child if does not already exist
        const cypher1 = `MERGE (n:NostrUser {pubkey: '${pubkey_child}'}) RETURN n.pubkey AS pubkey `
        const cypher1_results = await write(cypher1, {})
        console.log(typeof cypher1_results)
        // aCypherResults.push({cypher1, cypher1_results})

        // cypher2: add edge MUTES from pubkey_parent to pubkey_child; include timestamp!
        const cypher2 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'}), (m:NostrUser {pubkey: '${pubkey_child}'}) MERGE (n)-[r:MUTES]->(m) SET r.timestamp=${created_at_newMutes} `
        const cypher2_results = await write(cypher2, {})
        console.log(typeof cypher2_results)
        // aCypherResults.push({cypher2, cypher2_results})

        // ???? sql1a_pre: INSERT IGNORE pubkey='${pubkey_child}' (TODO: need to add pubkey_child to sql table users if not already present ???) (maybe avoid since this will trigger AUTO_INCREMENT and row ought to be present already??)
        
        // sql1a: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'
        const sqla = ` UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}' `
        const sqla_results = await connection.query(sqla);
        console.log(typeof sqla_results)
        // aCypherResults.push({sqla, sqla_results})
      }

      for (let z=0; z<aMutesToRemove.length; z++) {
        // get const pubkey_child
        const pubkey_child = aMutesToRemove[z]

        // cypher3: remove edge MUTES from pubkey_parent to pubkey_child
        const cypher3 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'})-[r:MUTES]->(m:NostrUser {pubkey: '${pubkey_child}'}) DELETE r `
        const cypher3_results = await write(cypher3, {})
        console.log(typeof cypher3_results)
        // aCypherResults.push({cypher3, cypher3_results})

        // sql1b: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'
        const sqlb = ` UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}' `
        const sqlb_results = await connection.query(sqlb);
        console.log(typeof sqlb_results)
        // aCypherResults.push({sqlb, sqlb_results})
      }

      // cleaning up; sqlc: UPDATE users SET flaggedToUpdateNeo4jMutes = 0 WHERE pubkey=pubkey_parent
      const sqlc = ` UPDATE users SET flaggedToUpdateNeo4jMutes = 0 WHERE pubkey='${pubkey_parent}' `
      const sqlc_results = await connection.query(sqlc);
      console.log(sqlc_results)
      // aCypherResults.push({sqlc, sqlc_results})

    }
    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    
    const response:ResponseData = {
      success: true,
      exists: true,
      message: `api/dataManagement/users/updateNeo4jMutesAndFlagToUpRevObObj data:`,
      data: { 
        numUsers: aUsers.length,
        aCypherResults,
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateNeo4jMutesAndFlagToUpRevObObj error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}