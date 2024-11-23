import { write } from '@/lib/neo4j'
import type { NextApiRequest, NextApiResponse } from 'next'

/*
to access:
https://graperank.tech/api/tests/neo4j/importCsv

LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MERGE (n:TestNostrUser {pubkey: row[1]})-[:TEST]->(m:TestNostrUser {pubkey: row[2]})

LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MERGE (n:TestNostrUser {pubkey: row[1]})
MERGE (m:TestNostrUser {pubkey: row[2]})
MERGE (n)-[:TEST]->(m)

LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MATCH (n:TestNostrUser {pubkey: row[1]}), (m:TestNostrUser {pubkey: row[2]})
MERGE (n)-[:TEST]->(m)

LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MERGE (n:TestNostrUser {pubkey: row[1]}), (m:TestNostrUser {pubkey: row[2]})
MERGE (n)-[:TEST]->(m)

MATCH (n)-[:TEST]->(m) RETURN n,m

MATCH (n:TestNostrUser) RETURN n

MATCH (n:TestNostrUser) DETACH DELETE n RETURN n

CREATE CONSTRAINT testNostUserUniquePubkey FOR (n:TestNostrUser) REQUIRE n.pubkey IS UNIQUE
*/

const cypher1 = `LOAD CSV FROM 'https://graperank.tech/api/tests/neo4j/generateCsv'
AS row
MERGE (n:TestNostrUser {pubkey: row[1]})
MERGE (m:TestNostrUser {pubkey: row[2]})
MERGE (n)-[:TEST]->(m)
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
