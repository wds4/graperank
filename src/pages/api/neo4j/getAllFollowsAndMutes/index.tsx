import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'

/*
usage:
https://www.graperank.tech/api/neo4j/getAllFollowsAndMutes
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
    const cypher1 = `MATCH (n:NostrUser)-[:FOLLOWS]->(m:NostrUser) RETURN n.pubkey, m.pubkey LIMIT 1000` // cypher command 
    try {
      const result1 = await read(cypher1, {})
      /*
      const aPubkeys = []
      const aUsers = JSON.parse(JSON.stringify(result1))
      for (let x=0; x < aUsers.length; x++) {
        const oNextUserData = aUsers[x]
        const pk = oNextUserData.m.properties.pubkey
        aPubkeys.push(pk)
      }
      */

      const response:ResponseData = {
        success: true,
        message: `api/neo4j/getAllFollowsAndMutes data:`,
        data: {
          cypher: cypher1,result1
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/neo4j/getAllFollowsAndMutes error: ${error}`,
        data: {
          cypher1
        }
      }
      res.status(500).json(response)
    }
}