import type { NextApiRequest, NextApiResponse } from 'next'
// import { int } from 'neo4j-driver'
import { read } from '../../../../lib/neo4j'

/*
to access:
http://localhost:3000/api/tests/neo4j
https://interpretation-brainstorm.vercel.app/api/tests/neo4j
*/

type ResponseData = {
  message: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {

  const result = await read(`MATCH (tom:Person {name: "Tom Hanks"}) RETURN tom`, {})
  console.log(`result: ${JSON.stringify(result)}`)

  res.status(200).json({ message: 'Hello from Next.js!' })
}
