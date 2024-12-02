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
    const cypher1 = `MATCH (n:NostrUser)-[:FOLLOWS]->(m:NostrUser) RETURN n.pubkey, m.pubkey LIMIT 1000`
    const cypher2 = `MATCH (n:NostrUser)-[:MUTES]->(m:NostrUser) RETURN n.pubkey, m.pubkey LIMIT 1000`
    try {
      const result_follow = await read(cypher1, {})
      const result_mute = await read(cypher2, {})

      // const aResult_follow = JSON.parse(JSON.stringify(result_follow))

      const response:ResponseData = {
        success: true,
        message: `api/neo4j/getAllFollowsAndMutes data:`,
        data: {
          cypher1, cypher2, result_follow, result_mute
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