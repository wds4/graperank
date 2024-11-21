import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'

/*
returns an array of all NostUser nodes in neo4j
usage:

http://localhost:3000/api/neo4j/getNostrUsers

https://www.graperank.tech/api/neo4j/getNostrUsers

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
  try {
    // cypher1: add node pubkey_parent if not already exists
    const cypher1 = await read(`MATCH (n:NostrUser) RETURN n `, {})
    console.log(cypher1)

    const response:ResponseData = {
      success: true,
      message: `api/neo4j/getNostrUsers data:`,
      data: { 
        cypher1
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getNostrUsers error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}