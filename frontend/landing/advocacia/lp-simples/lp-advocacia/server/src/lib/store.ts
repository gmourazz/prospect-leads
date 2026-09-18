import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.jsonl')

export interface ContactSubmission {
  name: string
  phone: string
  subject: string
  message: string
  receivedAt: string
}

export async function saveSubmission(entry: ContactSubmission): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.appendFile(SUBMISSIONS_FILE, JSON.stringify(entry) + '\n', 'utf8')
}
