import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { write } from '@/lib/neo4j'

/*
calculate DoS for all pubkeys relative to the reference pubkey, provided as pubkey1

set hops property for nodes in graph (Not intended for general usage; only for internal use)

usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/personalizedPageRank?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

cypher1: project graph:
MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f',
  source,
  target
)
// takes about 10 seconds

memory estimation:
CALL gds.pageRank.write.estimate('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f', {
  writeProperty: 'pageRank',
  maxIterations: 20,
  dampingFactor: 0.85
})
YIELD nodeCount, relationshipCount, bytesMin, bytesMax, requiredMemory
// about 4 MB

stream results: 
CALL gds.pageRank.stream('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC
// takes about 15 seconds

write results to neo4j
CALL gds.pageRank.write('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f', {
  maxIterations: 20,
  dampingFactor: 0.85,
  writeProperty: 'pagerank'
})
YIELD nodePropertiesWritten, ranIterations

cypher2: personalized pageRank and stream results:
MATCH (refUser:NostrUser {pubkey: 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'})
CALL gds.pageRank.stream('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f', {
  maxIterations: 20,
  dampingFactor: 0.85,
  sourceNodes: [refUser]
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC
// about 13 sec
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
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/personalizedPageRank: pubkey1 was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = `MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'personalizedPageRank_${pubkey1}',
  source,
  target
)`
      const cypher2 = `MATCH (refUser:NostrUser {pubkey: '${pubkey1}'})
CALL gds.pageRank.stream('personalizedPageRank_', {
  maxIterations: 20,
  dampingFactor: 0.85,
  sourceNodes: [refUser]
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC`
      try {
        const result_cypher1 = await write(cypher1, {})
        // console.log(result_cypher1)
        // const aResults1 = JSON.parse(JSON.stringify(result_cypher1))

        const result_cypher2 = await write(cypher2, {})
        // console.log(result_cypher2)
        // const aResults2 = JSON.parse(JSON.stringify(result_cypher2))

        const response:ResponseData = {
          success: true,
          message: `api/algos/personalizedPageRank data:`,
          data: {
            referencePubkey: pubkey1, 
            cypher1,
            cypher2,
            result_cypher1,
            result_cypher2,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/personalizedPageRank error: ${error}`,
          data: {
            pubkey1,
            cypher1
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/algos/personalizedPageRank: one or both of the provided pubkeys is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/personalizedPageRank: pubkey1 was not provided`
    }
    res.status(500).json(response)
  }
}