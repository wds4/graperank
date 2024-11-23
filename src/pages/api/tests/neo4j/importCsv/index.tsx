import { write } from '@/lib/neo4j'
import type { NextApiRequest, NextApiResponse } from 'next'

/*
to access:
http://localhost:3000/api/tests/neo4j/importCsv
https://graperank.tech/api/tests/neo4j/importCsv
*/

const cypher1 = `LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MERGE (n:NostrUser {pubkey: row[1]})-[:TEST]->(m:NostrUser {pubkey: row[2]})
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
    message: 'api/tests/neo4j Hello from Next.js!',
    data: {
      cypher1,
      cypher1_result,
    }
  }

  res.status(200).json(response)

}
