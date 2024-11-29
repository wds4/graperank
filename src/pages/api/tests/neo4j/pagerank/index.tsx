import { write } from '@/lib/neo4j'
import type { NextApiRequest, NextApiResponse } from 'next'

/*
to access:
https://graperank.tech/api/tests/neo4j/pagerank
*/

const cypher1 = `MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'myGraph',
  source,
  target,
  { relationshipProperties: r { .weight } }
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
