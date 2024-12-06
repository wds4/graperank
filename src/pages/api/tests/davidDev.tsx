import type { NextApiRequest, NextApiResponse } from 'next'
// import { calculate } from 'graperank-nodejs/src/Calculator'

type ResponseData = {
  message: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {

  res.status(200).json({ message: 'api/tests Hello from Next.js!' })
}
