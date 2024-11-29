import { write } from '@/lib/neo4j'
import type { NextApiRequest, NextApiResponse } from 'next'

/*
to access:
https://graperank.tech/api/tests/neo4j/pagerank


// define graph
MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'nostrPagerank',
  source,
  target
)

// estimate how much memory is required
CALL gds.pageRank.write.estimate('nostrPagerank', {
  writeProperty: 'pageRank',
  maxIterations: 20,
  dampingFactor: 0.85
})
YIELD nodeCount, relationshipCount, bytesMin, bytesMax, requiredMemory

// stream output
CALL gds.pageRank.stream('nostrPagerank')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC
// took about 14 seconds
*/

const cypher1 = `MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'nostrPagerank',
  source,
  target
)
`

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const cypher1_result = await write(cypher1, {})
  console.log(`result: ${JSON.stringify(cypher1_result)}`)

  const response:ResponseData = {
    success: true,
    message: 'api/tests/neo4j/pagerank Hello from Next.js!',
    data: {
      cypher1,
      cypher1_result,
    }
  }

  res.status(200).json(response)

}
