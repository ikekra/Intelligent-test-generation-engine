import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import OpenAI from 'openai'
import { createTwoFilesPatch } from 'diff'
import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 5174
const maxOutputTokens = 1800
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (clientOrigins.includes(origin)) return callback(null, true)
      if (process.env.NODE_ENV !== 'production' && devOriginPattern.test(origin)) {
        return callback(null, true)
      }
      return callback(new Error('CORS not allowed'), false)
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use((req, res, next) => {
  const connectSrc = [
    "'self'",
    'http://localhost:5174',
    'ws://localhost:5173',
    'ws://localhost:5175',
    'http://localhost:5173',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5175',
  ]
    .concat(clientOrigins)
    .join(' ')
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; connect-src ${connectSrc}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`,
  )
  next()
})

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end()
})

const workspaceRoot = process.cwd()
const uploadsDir = path.join(workspaceRoot, 'uploads')
const exportsDir = path.join(workspaceRoot, 'exports')

await fs.mkdir(uploadsDir, { recursive: true })
await fs.mkdir(exportsDir, { recursive: true })

const rawMongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/itge'
const mongoUrl = rawMongoUrl.endsWith('/')
  ? `${rawMongoUrl}itge`
  : rawMongoUrl
const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me'
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)
const runsPerDayLimit = Number(process.env.RUNS_PER_DAY_LIMIT || 50)
const tokensPerDayLimit = Number(process.env.TOKENS_PER_DAY_LIMIT || 200000)
const planByEmail = (process.env.USER_PLANS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((pair) => {
    const [email, plan] = pair.split(':')
    return [email?.toLowerCase(), plan || 'free']
  })
const planLookup = new Map(planByEmail)

try {
  await mongoose.connect(mongoUrl)
  console.log(`Mongo connected: ${mongoUrl}`)
} catch (error) {
  console.error('Mongo connection failed:', error?.message || error)
  process.exit(1)
}

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    major: { type: String, default: '' },
    year: { type: String, default: '' },
    university: { type: String, default: '' },
    bio: { type: String, default: '' },
  },
  { timestamps: true },
)

const runSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    language: String,
    framework: String,
    tokenEstimate: Number,
    fileCount: Number,
    includeIntegration: Boolean,
    includeRegression: Boolean,
    integrityMode: Boolean,
  },
  { timestamps: true },
)

const workSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    title: { type: String, required: true },
    content: { type: String, required: true },
    language: String,
    framework: String,
  },
  { timestamps: true },
)

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    message: { type: String, required: true },
  },
  { timestamps: true },
)

const activitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    action: { type: String, required: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true },
)

const versionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    label: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
)

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

const teamMemberSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, default: 'member' },
  },
  { timestamps: true },
)

const teamInviteSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    email: { type: String, required: true, lowercase: true },
    token: { type: String, required: true },
    status: { type: String, default: 'pending' },
  },
  { timestamps: true },
)

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    state: { type: Object, default: {} },
    fileList: { type: [String], default: [] },
  },
  { timestamps: true },
)

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    course: { type: String, default: '' },
    dueDate: { type: Date, default: null },
    rubric: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    integrityMode: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const User = mongoose.model('User', userSchema)
const Run = mongoose.model('Run', runSchema)
const Team = mongoose.model('Team', teamSchema)
const TeamMember = mongoose.model('TeamMember', teamMemberSchema)
const TeamInvite = mongoose.model('TeamInvite', teamInviteSchema)
const Workspace = mongoose.model('Workspace', workspaceSchema)
const Assignment = mongoose.model('Assignment', assignmentSchema)
const WorkItem = mongoose.model('WorkItem', workSchema)
const Comment = mongoose.model('Comment', commentSchema)
const Activity = mongoose.model('Activity', activitySchema)
const Version = mongoose.model('Version', versionSchema)

const createToken = (user) =>
  jwt.sign({ sub: user._id.toString(), email: user.email }, jwtSecret, {
    expiresIn: '7d',
  })

const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.token
  if (!token) return next()
  try {
    const payload = jwt.verify(token, jwtSecret)
    const user = await User.findById(payload.sub).lean()
    req.user = user || null
  } catch {
    req.user = null
  }
  next()
}

app.use(authMiddleware)

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  next()
}

const requireAdmin = (req, res, next) => {
  if (!req.user || !adminEmails.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ error: 'Admin only.' })
  }
  next()
}

const isMemberOfTeam = async (userId, teamId) => {
  if (!teamId) return false
  const membership = await TeamMember.findOne({ userId, teamId })
  return Boolean(membership)
}

const getTeamRole = async (userId, teamId) => {
  if (!teamId) return null
  const membership = await TeamMember.findOne({ userId, teamId }).lean()
  return membership?.role || null
}

const canManageTeamRole = (role) =>
  ['owner', 'admin', 'teacher'].includes(role)

const requireTeamRole = (roles) => async (req, res, next) => {
  const { id } = req.params
  const role = await getTeamRole(req.user._id, id)
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ error: 'Insufficient team permissions.' })
  }
  next()
}

const normalizeEmail = (value = '') => value.trim().toLowerCase()
const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isValidPassword = (value = '') => value.length >= 8

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.-]+/g, '_')
    cb(null, `${Date.now()}_${safeName}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
})

const extLanguageMap = new Map([
  ['.py', 'Python'],
  ['.js', 'JavaScript'],
  ['.jsx', 'JavaScript'],
  ['.ts', 'TypeScript'],
  ['.tsx', 'TypeScript'],
  ['.java', 'Java'],
  ['.kt', 'Kotlin'],
  ['.go', 'Go'],
  ['.rb', 'Ruby'],
  ['.cs', 'C#'],
  ['.php', 'PHP'],
  ['.rs', 'Rust'],
  ['.cpp', 'C++'],
  ['.c', 'C'],
])

const defaultFrameworkByLanguage = {
  Python: 'PyTest',
  JavaScript: 'Jest',
  TypeScript: 'Jest',
  Java: 'JUnit',
  Kotlin: 'JUnit',
  Go: 'testing',
  Ruby: 'RSpec',
  'C#': 'xUnit',
  PHP: 'PHPUnit',
  Rust: 'cargo test',
  'C++': 'GoogleTest',
  C: 'Unity',
}

const normalizeFramework = (value, language) =>
  value?.trim() || defaultFrameworkByLanguage[language] || 'Jest'

const detectLanguageFromFiles = (files) => {
  const counts = {}
  files.forEach((file) => {
    const ext = path.extname(file.name || file.path || '')
    const language = extLanguageMap.get(ext)
    if (language) {
      counts[language] = (counts[language] || 0) + 1
    }
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || 'JavaScript'
}

const detectLanguageFromText = (input) => {
  if (!input) return 'JavaScript'
  if (input.includes('def ') || input.includes('import pytest')) return 'Python'
  if (input.includes('public class') || input.includes('System.out'))
    return 'Java'
  if (input.includes('package main') || input.includes('func main'))
    return 'Go'
  if (input.includes('using System') || input.includes('namespace'))
    return 'C#'
  if (input.includes('func') && input.includes('let ') && input.includes('Swift'))
    return 'Swift'
  return 'JavaScript'
}

const buildAssignmentContext = (assignment) => {
  if (!assignment) return ''
  const lines = [
    `Title: ${assignment.title}`,
    assignment.course ? `Course: ${assignment.course}` : '',
    assignment.dueDate
      ? `Due: ${new Date(assignment.dueDate).toDateString()}`
      : '',
    assignment.description ? `Description: ${assignment.description}` : '',
    assignment.rubric ? `Rubric: ${assignment.rubric}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

const logActivity = async (payload) => {
  try {
    await Activity.create(payload)
  } catch (error) {
    console.error('Activity log failed:', error?.message || error)
  }
}

const buildPrompt = ({
  language,
  framework,
  includeIntegration,
  includeRegression,
  integrityMode,
  assignmentContext,
  source,
}) => {
  const integrityBlock = integrityMode
    ? `Academic integrity requirements:
- Do NOT provide solution code, only tests and analysis.
- Prefer black-box tests derived from behavior, not implementation details.
- Avoid overfitting to any single solution.
- If unsure about behavior, add "// NEEDS HUMAN REVIEW".`
    : ''

  const assignmentBlock = assignmentContext
    ? `ASSIGNMENT CONTEXT:
${assignmentContext}`
    : ''

  return `You are an expert software testing engineer and static analysis specialist.
Analyze the provided code and generate a complete, meaningful test suite.

Return STRICT JSON with these keys:
- coverage_analysis: array of { function, risk }
- untested_paths: string[]
- generated_tests: string (complete, runnable test file)
- coverage_improvement: string
- suggested_follow_up: string

Requirements:
- Use ${framework} and ${language}
- Each test must have descriptive name: "[function] — [scenario] — [expected]"
- Include happy path, edge cases, failure cases, integration tests (if enabled), regression guards (if enabled)
- Avoid trivial tests
- If unsure about behavior, add comment "// NEEDS HUMAN REVIEW"

Integration tests enabled: ${includeIntegration ? 'yes' : 'no'}
Regression guards enabled: ${includeRegression ? 'yes' : 'no'}
Plagiarism-safe integrity mode: ${integrityMode ? 'enabled' : 'off'}
${integrityBlock}
${assignmentBlock}

SOURCE:
${source}`
}

const buildStreamingPrompt = ({
  language,
  framework,
  includeIntegration,
  includeRegression,
  integrityMode,
  assignmentContext,
  source,
}) => {
  const integrityBlock = integrityMode
    ? `Academic integrity requirements:
- Do NOT provide solution code, only tests and analysis.
- Prefer black-box tests derived from behavior, not implementation details.
- Avoid overfitting to any single solution.
- If unsure about behavior, add "// NEEDS HUMAN REVIEW".`
    : ''

  const assignmentBlock = assignmentContext
    ? `ASSIGNMENT CONTEXT:
${assignmentContext}`
    : ''

  return `You are an expert software testing engineer and static analysis specialist.
Generate a complete, meaningful test suite.

Return MARKDOWN with these exact sections:
### Coverage analysis
### Untested paths found
### Generated tests
### Coverage improvement estimate
### Suggested follow-up

Requirements:
- Use ${framework} and ${language}
- Each test must have descriptive name: "[function] — [scenario] — [expected]"
- Include happy path, edge cases, failure cases, integration tests (if enabled), regression guards (if enabled)
- Avoid trivial tests
- If unsure about behavior, add comment "// NEEDS HUMAN REVIEW"

Integration tests enabled: ${includeIntegration ? 'yes' : 'no'}
Regression guards enabled: ${includeRegression ? 'yes' : 'no'}
Plagiarism-safe integrity mode: ${integrityMode ? 'enabled' : 'off'}
${integrityBlock}
${assignmentBlock}

SOURCE:
${source}`
}

const parseSectionsFromMarkdown = (text = '') => {
  const sections = {
    coverage_analysis: [],
    untested_paths: [],
    generated_tests: '',
    coverage_improvement: '',
    suggested_follow_up: '',
  }

  const getSection = (label) => {
    const pattern = new RegExp(
      `### ${label}\\n([\\s\\S]*?)(?=\\n### |$)`,
      'i',
    )
    const match = text.match(pattern)
    return match ? match[1].trim() : ''
  }

  const toList = (value) =>
    value
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)

  sections.coverage_analysis = toList(getSection('Coverage analysis')).map(
    (line) => {
      const [fn, risk] = line.split('—').map((part) => part.trim())
      return { function: fn || line, risk: risk || 'MEDIUM' }
    },
  )
  sections.untested_paths = toList(getSection('Untested paths found'))

  const testsBlock = getSection('Generated tests')
  const codeMatch = testsBlock.match(/```[\s\S]*?\n([\s\S]*?)```/)
  sections.generated_tests = codeMatch ? codeMatch[1].trim() : testsBlock

  sections.coverage_improvement = getSection('Coverage improvement estimate')
  sections.suggested_follow_up = getSection('Suggested follow-up')

  return sections
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState,
  })
})

app.get('/api/routes', (req, res) => {
  const routes = []
  const stack = app._router?.stack || app.router?.stack || []
  stack.forEach((layer) => {
    if (layer.route?.path) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods || {}),
      })
    }
  })
  res.json({ routes })
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, major, year, university, bio } = req.body || {}
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || !password) {
      return res.status(422).json({ error: 'Email and password required.' })
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(422).json({ error: 'Invalid email format.' })
    }
    if (!isValidPassword(password)) {
      return res
        .status(422)
        .json({ error: 'Password must be at least 8 characters.' })
    }
    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(400).json({ error: 'Account already exists.' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: name || '',
      major: major || '',
      year: year || '',
      university: university || '',
      bio: bio || '',
    })
    const token = createToken(user)
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    res.json({
      email: user.email,
      name: user.name,
      isAdmin: adminEmails.includes(user.email.toLowerCase()),
      major: user.major,
      year: user.year,
      university: user.university,
      bio: user.bio,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to register.',
      detail: error?.message || String(error),
    })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || !password) {
      return res.status(422).json({ error: 'Email and password required.' })
    }
    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' })
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(400).json({ error: 'Invalid credentials.' })
    }
    const token = createToken(user)
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    res.json({
      email: user.email,
      name: user.name,
      isAdmin: adminEmails.includes(user.email.toLowerCase()),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to login.',
      detail: error?.message || String(error),
    })
  }
})

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  const plan = planLookup.get(req.user.email.toLowerCase()) || 'free'
  res.json({
    email: req.user.email,
    name: req.user.name,
    isAdmin: adminEmails.includes(req.user.email.toLowerCase()),
    plan,
    major: req.user.major,
    year: req.user.year,
    university: req.user.university,
    bio: req.user.bio,
  })
})

app.post('/api/teams', requireAuth, async (req, res) => {
  const { name } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Team name required.' })
  const team = await Team.create({ name, ownerId: req.user._id })
  await TeamMember.create({ teamId: team._id, userId: req.user._id, role: 'owner' })
  await logActivity({
    userId: req.user._id,
    teamId: team._id,
    action: 'team_created',
    metadata: { name: team.name },
  })
  res.json(team)
})

app.get('/api/teams', requireAuth, async (req, res) => {
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)
  const teams = await Team.find({ _id: { $in: teamIds } }).lean()
  res.json({ teams })
})

app.get('/api/teams/:id/role', requireAuth, async (req, res) => {
  const { id } = req.params
  const role = await getTeamRole(req.user._id, id)
  if (!role) return res.status(403).json({ error: 'Not a team member.' })
  res.json({ role })
})

app.get(
  '/api/teams/:id/dashboard',
  requireAuth,
  requireTeamRole(['owner', 'admin', 'teacher']),
  async (req, res) => {
    const { id } = req.params
    const teamId = id
    const members = await TeamMember.find({ teamId }).lean()
    const memberCount = members.length
    const totalRuns = await Run.countDocuments({ teamId })
    const tokensAgg = await Run.aggregate([
      { $match: { teamId: new mongoose.Types.ObjectId(teamId) } },
      { $group: { _id: null, sum: { $sum: '$tokenEstimate' } } },
    ])
    const totalTokens = Number(tokensAgg[0]?.sum || 0)
    const runsByAssignment = await Run.aggregate([
      { $match: { teamId: new mongoose.Types.ObjectId(teamId) } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    const assignmentIds = runsByAssignment
      .map((item) => item._id)
      .filter(Boolean)
    const assignments = await Assignment.find({ _id: { $in: assignmentIds } })
      .lean()
    const assignmentById = new Map(
      assignments.map((assignment) => [assignment._id.toString(), assignment]),
    )
    const assignmentStats = runsByAssignment.map((item) => ({
      assignmentId: item._id,
      title: item._id
        ? assignmentById.get(item._id.toString())?.title || 'Unknown assignment'
        : 'Unassigned',
      count: item.count,
    }))
    const recentRuns = await Run.find({ teamId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
    res.json({
      memberCount,
      totalRuns,
      totalTokens,
      assignmentStats,
      recentRuns,
    })
  },
)

app.post('/api/teams/:id/invite', requireAuth, async (req, res) => {
  const { email } = req.body || {}
  const teamId = req.params.id
  if (!email) return res.status(400).json({ error: 'Email required.' })
  const role = await getTeamRole(req.user._id, teamId)
  if (!role || !['owner', 'admin', 'teacher'].includes(role)) {
    return res.status(403).json({ error: 'Insufficient team permissions.' })
  }
  const token = crypto.randomBytes(16).toString('hex')
  const invite = await TeamInvite.create({
    teamId,
    email: email.toLowerCase(),
    token,
  })
  res.json({ inviteToken: invite.token })
})

app.get('/api/teams/invites', requireAuth, async (req, res) => {
  const invites = await TeamInvite.find({
    email: req.user.email.toLowerCase(),
    status: 'pending',
  }).lean()
  res.json({ invites })
})

app.post('/api/teams/invites/accept', requireAuth, async (req, res) => {
  const { token } = req.body || {}
  const invite = await TeamInvite.findOne({
    token,
    email: req.user.email.toLowerCase(),
  })
  if (!invite || invite.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid invite.' })
  }
  await TeamMember.create({
    teamId: invite.teamId,
    userId: req.user._id,
    role: 'member',
  })
  invite.status = 'accepted'
  await invite.save()
  res.json({ ok: true })
})

app.get('/api/teams/:id/members', requireAuth, async (req, res) => {
  const { id } = req.params
  const member = await isMemberOfTeam(req.user._id, id)
  if (!member) return res.status(403).json({ error: 'Not a team member.' })
  const members = await TeamMember.find({ teamId: id }).lean()
  const userIds = members.map((m) => m.userId)
  const users = await User.find({ _id: { $in: userIds } }).lean()
  const usersById = new Map(users.map((u) => [u._id.toString(), u]))
  res.json({
    members: members.map((m) => ({
      _id: m._id,
      userId: m.userId,
      role: m.role,
      email: usersById.get(m.userId.toString())?.email || '',
    })),
  })
})

app.patch(
  '/api/teams/:id/members/:memberId/role',
  requireAuth,
  requireTeamRole(['owner', 'admin', 'teacher']),
  async (req, res) => {
    const { id, memberId } = req.params
    const { role } = req.body || {}
    if (!['owner', 'admin', 'teacher', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' })
    }
    const member = await TeamMember.findById(memberId)
    if (!member || member.teamId.toString() !== id) {
      return res.status(404).json({ error: 'Member not found.' })
    }
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Owner role cannot be changed.' })
    }
    member.role = role
    await member.save()
    res.json({ ok: true })
  },
)

app.delete(
  '/api/teams/:id/members/:memberId',
  requireAuth,
  requireTeamRole(['owner', 'admin', 'teacher']),
  async (req, res) => {
    const { id, memberId } = req.params
    const member = await TeamMember.findById(memberId)
    if (!member || member.teamId.toString() !== id) {
      return res.status(404).json({ error: 'Member not found.' })
    }
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot be removed.' })
    }
    await member.deleteOne()
    res.json({ ok: true })
  },
)

app.post('/api/workspaces', requireAuth, async (req, res) => {
  const { name, description, teamId, assignmentId, state, fileList } =
    req.body || {}
  if (!name) return res.status(400).json({ error: 'Workspace name required.' })
  if (teamId) {
    const member = await isMemberOfTeam(req.user._id, teamId)
    if (!member) return res.status(403).json({ error: 'Not a team member.' })
  }
  if (assignmentId) {
    const assignment = await Assignment.findById(assignmentId)
    if (!assignment) {
      return res.status(400).json({ error: 'Assignment not found.' })
    }
    if (assignment.teamId) {
      const member = await isMemberOfTeam(req.user._id, assignment.teamId)
      if (!member) {
        return res.status(403).json({ error: 'No assignment access.' })
      }
    } else if (
      assignment.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'No assignment access.' })
    }
  }
  const workspace = await Workspace.create({
    name,
    description: description || '',
    ownerId: req.user._id,
    teamId: teamId || null,
    assignmentId: assignmentId || null,
    state: state || {},
    fileList: fileList || [],
  })
  await logActivity({
    userId: req.user._id,
    teamId: teamId || null,
    action: 'workspace_created',
    metadata: { name },
  })
  res.json(workspace)
})

app.get('/api/workspaces', requireAuth, async (req, res) => {
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)
  const workspaces = await Workspace.find({
    $or: [{ ownerId: req.user._id }, { teamId: { $in: teamIds } }],
  }).lean()
  res.json({ workspaces })
})

app.get('/api/workspaces/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const workspace = await Workspace.findById(id)
  if (!workspace) return res.status(404).json({ error: 'Not found.' })
  if (
    workspace.ownerId.toString() !== req.user._id.toString() &&
    !(await isMemberOfTeam(req.user._id, workspace.teamId))
  ) {
    return res.status(403).json({ error: 'No workspace access.' })
  }
  res.json(workspace)
})

app.patch('/api/workspaces/:id/state', requireAuth, async (req, res) => {
  const { id } = req.params
  const { state, fileList } = req.body || {}
  const workspace = await Workspace.findById(id)
  if (!workspace) return res.status(404).json({ error: 'Not found.' })
  const isOwner = workspace.ownerId.toString() === req.user._id.toString()
  const teamRole = await getTeamRole(req.user._id, workspace.teamId)
  if (!isOwner && !['owner', 'admin', 'teacher'].includes(teamRole)) {
    return res.status(403).json({ error: 'Insufficient permissions.' })
  }
  workspace.state = state || {}
  workspace.fileList = fileList || []
  await workspace.save()
  res.json({ ok: true })
})

app.post('/api/assignments', requireAuth, async (req, res) => {
  const {
    title,
    description,
    course,
    dueDate,
    rubric,
    teamId,
    integrityMode,
  } = req.body || {}

  if (!title) return res.status(400).json({ error: 'Title required.' })

  if (teamId) {
    const role = await getTeamRole(req.user._id, teamId)
    if (!role) return res.status(403).json({ error: 'Not a team member.' })
    if (!canManageTeamRole(role)) {
      return res.status(403).json({ error: 'Teacher or admin required.' })
    }
  }

  const assignment = await Assignment.create({
    title,
    description: description || '',
    course: course || '',
    dueDate: dueDate ? new Date(dueDate) : null,
    rubric: rubric || '',
    createdBy: req.user._id,
    teamId: teamId || null,
    integrityMode: integrityMode !== false,
  })
  await logActivity({
    userId: req.user._id,
    teamId: teamId || null,
    action: 'assignment_created',
    metadata: { title, course },
  })

  res.json(assignment)
})

app.get('/api/assignments', requireAuth, async (req, res) => {
  const { teamId } = req.query || {}
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)

  if (teamId) {
    if (!teamIds.find((id) => id.toString() === String(teamId))) {
      return res.status(403).json({ error: 'Not a team member.' })
    }
    const assignments = await Assignment.find({ teamId }).sort({ createdAt: -1 })
    return res.json({ assignments })
  }

  const assignments = await Assignment.find({
    $or: [{ createdBy: req.user._id }, { teamId: { $in: teamIds } }],
  }).sort({ createdAt: -1 })

  res.json({ assignments })
})

app.get('/api/assignments/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const assignment = await Assignment.findById(id)
  if (!assignment) return res.status(404).json({ error: 'Not found.' })
  if (assignment.teamId) {
    const member = await isMemberOfTeam(req.user._id, assignment.teamId)
    if (!member) return res.status(403).json({ error: 'No assignment access.' })
  } else if (assignment.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'No assignment access.' })
  }
  res.json(assignment)
})

app.get('/api/assignments/:id/report', requireAuth, async (req, res) => {
  const { id } = req.params
  const format = (req.query.format || 'json').toString().toLowerCase()
  const assignment = await Assignment.findById(id)
  if (!assignment) return res.status(404).json({ error: 'Not found.' })

  if (assignment.teamId) {
    const role = await getTeamRole(req.user._id, assignment.teamId)
    if (!role || !canManageTeamRole(role)) {
      return res.status(403).json({ error: 'Teacher or admin required.' })
    }
  } else if (assignment.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'No assignment access.' })
  }

  const runs = await Run.find({ assignmentId: assignment._id })
    .sort({ createdAt: -1 })
    .lean()

  const totalRuns = runs.length
  const totalTokens = runs.reduce(
    (sum, run) => sum + Number(run.tokenEstimate || 0),
    0,
  )
  const languageCounts = runs.reduce((acc, run) => {
    const key = run.language || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const report = {
    assignment: {
      id: assignment._id,
      title: assignment.title,
      course: assignment.course,
      dueDate: assignment.dueDate,
      rubric: assignment.rubric,
      integrityMode: assignment.integrityMode,
    },
    totals: {
      runs: totalRuns,
      tokens: totalTokens,
      languages: languageCounts,
    },
    runs: runs.map((run) => ({
      id: run._id,
      createdAt: run.createdAt,
      language: run.language,
      framework: run.framework,
      tokenEstimate: run.tokenEstimate,
      includeIntegration: run.includeIntegration,
      includeRegression: run.includeRegression,
      integrityMode: run.integrityMode,
      teamId: run.teamId,
      workspaceId: run.workspaceId,
      userId: run.userId,
    })),
  }

  if (format === 'json') {
    const targetPath = path.join(
      exportsDir,
      `assignment-report-${assignment._id}-${Date.now()}.json`,
    )
    await fs.writeFile(targetPath, JSON.stringify(report, null, 2), 'utf8')
    return res.json({ path: targetPath, report })
  }

  const header = [
    'run_id',
    'created_at',
    'language',
    'framework',
    'token_estimate',
    'integration',
    'regression',
    'integrity_mode',
    'user_id',
    'team_id',
    'workspace_id',
  ]
  const rows = runs.map((run) => [
    run._id,
    run.createdAt?.toISOString?.() || run.createdAt,
    run.language || '',
    run.framework || '',
    run.tokenEstimate || 0,
    run.includeIntegration ? 'yes' : 'no',
    run.includeRegression ? 'yes' : 'no',
    run.integrityMode ? 'yes' : 'no',
    run.userId || '',
    run.teamId || '',
    run.workspaceId || '',
  ])
  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')

  const targetPath = path.join(
    exportsDir,
    `assignment-report-${assignment._id}-${Date.now()}.csv`,
  )
  await fs.writeFile(targetPath, csv, 'utf8')
  res.json({ path: targetPath })
})

app.patch('/api/assignments/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const assignment = await Assignment.findById(id)
  if (!assignment) return res.status(404).json({ error: 'Not found.' })
  if (assignment.teamId) {
    const role = await getTeamRole(req.user._id, assignment.teamId)
    if (!role || !canManageTeamRole(role)) {
      return res.status(403).json({ error: 'Teacher or admin required.' })
    }
  } else if (assignment.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'No assignment access.' })
  }

  const { title, description, course, dueDate, rubric, integrityMode } =
    req.body || {}
  if (title !== undefined) assignment.title = title
  if (description !== undefined) assignment.description = description
  if (course !== undefined) assignment.course = course
  if (rubric !== undefined) assignment.rubric = rubric
  if (dueDate !== undefined)
    assignment.dueDate = dueDate ? new Date(dueDate) : null
  if (integrityMode !== undefined) assignment.integrityMode = integrityMode

  await assignment.save()
  res.json(assignment)
})

app.delete('/api/assignments/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const assignment = await Assignment.findById(id)
  if (!assignment) return res.status(404).json({ error: 'Not found.' })
  if (assignment.teamId) {
    const role = await getTeamRole(req.user._id, assignment.teamId)
    if (!role || !canManageTeamRole(role)) {
      return res.status(403).json({ error: 'Teacher or admin required.' })
    }
  } else if (assignment.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'No assignment access.' })
  }
  await assignment.deleteOne()
  res.json({ ok: true })
})

app.get('/api/dashboard', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const totalRuns = await Run.countDocuments({ userId: req.user._id })
  const recentRuns = await Run.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  const avgTokensAgg = await Run.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, avg: { $avg: '$tokenEstimate' } } },
  ])
  const avgTokens = Math.round(avgTokensAgg[0]?.avg || 0)
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)
  const teamRuns = await Run.find({ teamId: { $in: teamIds } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  const recentAssignments = await Assignment.find({
    $or: [{ createdBy: req.user._id }, { teamId: { $in: teamIds } }],
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  const recentWork = await WorkItem.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  const runsToday = await Run.countDocuments({
    userId: req.user._id,
    createdAt: { $gte: since },
  })
  const tokensAgg = await Run.aggregate([
    { $match: { userId: req.user._id, createdAt: { $gte: since } } },
    { $group: { _id: null, sum: { $sum: '$tokenEstimate' } } },
  ])
  const tokensToday = Number(tokensAgg[0]?.sum || 0)
  res.json({
    totalRuns,
    avgTokens,
    recentRuns,
    teamRuns,
    recentAssignments,
    recentWork,
    usage: {
      runsToday,
      runsLimit: runsPerDayLimit,
      tokensToday,
      tokensLimit: tokensPerDayLimit,
    },
  })
})

app.get('/api/billing/usage', requireAuth, async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const runsToday = await Run.countDocuments({
    userId: req.user._id,
    createdAt: { $gte: since },
  })
  const tokensAgg = await Run.aggregate([
    { $match: { userId: req.user._id, createdAt: { $gte: since } } },
    { $group: { _id: null, sum: { $sum: '$tokenEstimate' } } },
  ])
  const tokensToday = Number(tokensAgg[0]?.sum || 0)
  res.json({
    runsToday,
    runsLimit: runsPerDayLimit,
    tokensToday,
    tokensLimit: tokensPerDayLimit,
  })
})

app.get('/api/admin/audit', requireAdmin, async (req, res) => {
  const users = await User.find().lean()
  const runs = await Run.find().sort({ createdAt: -1 }).limit(50).lean()
  const assignments = await Assignment.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  const work = await WorkItem.find().sort({ createdAt: -1 }).limit(50).lean()
  res.json({ users, runs, assignments, work })
})

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean()
  res.json({ users })
})

app.patch('/api/profile', requireAuth, async (req, res) => {
  const { name, password, major, year, university, bio } = req.body || {}
  const user = await User.findById(req.user._id)
  if (!user) return res.status(404).json({ error: 'User not found.' })
  if (name !== undefined) user.name = String(name).trim()
  if (major !== undefined) user.major = String(major).trim()
  if (year !== undefined) user.year = String(year).trim()
  if (university !== undefined) user.university = String(university).trim()
  if (bio !== undefined) user.bio = String(bio).trim()
  if (password) {
    if (!isValidPassword(password)) {
      return res
        .status(422)
        .json({ error: 'Password must be at least 8 characters.' })
    }
    user.passwordHash = await bcrypt.hash(password, 10)
  }
  await user.save()
  res.json({
    email: user.email,
    name: user.name,
    isAdmin: adminEmails.includes(user.email.toLowerCase()),
    major: user.major,
    year: user.year,
    university: user.university,
    bio: user.bio,
  })
})

app.post('/api/work', requireAuth, async (req, res) => {
  const { title, content, language, framework, teamId, assignmentId, workspaceId } =
    req.body || {}
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content required.' })
  }
  if (teamId) {
    const member = await isMemberOfTeam(req.user._id, teamId)
    if (!member) return res.status(403).json({ error: 'Not a team member.' })
  }
  const work = await WorkItem.create({
    userId: req.user._id,
    teamId: teamId || null,
    assignmentId: assignmentId || null,
    workspaceId: workspaceId || null,
    title,
    content,
    language: language || '',
    framework: framework || '',
  })
  await logActivity({
    userId: req.user._id,
    teamId: teamId || null,
    action: 'work_saved',
    metadata: { title, assignmentId: assignmentId || null },
  })
  res.json(work)
})

app.get('/api/work', requireAuth, async (req, res) => {
  const work = await WorkItem.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  res.json({ work })
})

app.get(
  '/api/teams/:id/work',
  requireAuth,
  requireTeamRole(['owner', 'admin', 'teacher']),
  async (req, res) => {
    const { id } = req.params
    const work = await WorkItem.find({ teamId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    res.json({ work })
  },
)

app.post('/api/comments', requireAuth, async (req, res) => {
  const { message, teamId, workspaceId, assignmentId } = req.body || {}
  if (!message) return res.status(400).json({ error: 'Message required.' })
  if (teamId) {
    const member = await isMemberOfTeam(req.user._id, teamId)
    if (!member) return res.status(403).json({ error: 'Not a team member.' })
  }
  const comment = await Comment.create({
    userId: req.user._id,
    teamId: teamId || null,
    workspaceId: workspaceId || null,
    assignmentId: assignmentId || null,
    message,
  })
  await logActivity({
    userId: req.user._id,
    teamId: teamId || null,
    action: 'comment_added',
    metadata: { message: message.slice(0, 120) },
  })
  res.json(comment)
})

app.get('/api/comments', requireAuth, async (req, res) => {
  const { teamId, workspaceId, assignmentId } = req.query || {}
  const query = {}
  if (teamId) query.teamId = teamId
  if (workspaceId) query.workspaceId = workspaceId
  if (assignmentId) query.assignmentId = assignmentId
  const comments = await Comment.find(query).sort({ createdAt: -1 }).lean()
  res.json({ comments })
})

app.post('/api/versions', requireAuth, async (req, res) => {
  const { label, content, teamId, assignmentId, workspaceId } = req.body || {}
  if (!label || !content)
    return res.status(400).json({ error: 'Label and content required.' })
  if (teamId) {
    const member = await isMemberOfTeam(req.user._id, teamId)
    if (!member) return res.status(403).json({ error: 'Not a team member.' })
  }
  const version = await Version.create({
    userId: req.user._id,
    teamId: teamId || null,
    assignmentId: assignmentId || null,
    workspaceId: workspaceId || null,
    label,
    content,
  })
  await logActivity({
    userId: req.user._id,
    teamId: teamId || null,
    action: 'version_saved',
    metadata: { label },
  })
  res.json(version)
})

app.get('/api/versions', requireAuth, async (req, res) => {
  const { teamId, assignmentId, workspaceId } = req.query || {}
  const query = {}
  if (teamId) query.teamId = teamId
  if (assignmentId) query.assignmentId = assignmentId
  if (workspaceId) query.workspaceId = workspaceId
  const versions = await Version.find(query).sort({ createdAt: -1 }).lean()
  res.json({ versions })
})

app.get(
  '/api/teams/:id/activity',
  requireAuth,
  requireTeamRole(['owner', 'admin', 'teacher']),
  async (req, res) => {
    const { id } = req.params
    const activity = await Activity.find({ teamId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    res.json({ activity })
  },
)

app.post('/api/upload', upload.array('files', 50), (req, res) => {
  const files = (req.files || []).map((file) => ({
    name: file.originalname,
    path: file.path,
    size: file.size,
  }))
  res.json({ files })
})

app.post('/api/generate', async (req, res) => {
  try {
    const {
      input = '',
      files = [],
      options = {},
      language: requestedLanguage,
      framework: requestedFramework,
      stream = false,
      teamId,
      workspaceId,
      assignmentId,
    } = req.body || {}

    const detectedLanguage =
      requestedLanguage ||
      (files.length ? detectLanguageFromFiles(files) : detectLanguageFromText(input))

    const language = detectedLanguage
    const framework = normalizeFramework(requestedFramework, language)

    const compiledFiles = files
      .map(
        (file) =>
          `FILE: ${file.name}\n${file.content || ''}\nEND FILE: ${file.name}`,
      )
      .join('\n\n')

    const source = [input, compiledFiles].filter(Boolean).join('\n\n')

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: 'OPENAI_API_KEY is not set in the server environment.',
      })
    }

    if (req.user) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const runsToday = await Run.countDocuments({
        userId: req.user._id,
        createdAt: { $gte: since },
      })
      const tokensAgg = await Run.aggregate([
        { $match: { userId: req.user._id, createdAt: { $gte: since } } },
        { $group: { _id: null, sum: { $sum: '$tokenEstimate' } } },
      ])
      const tokensToday = Number(tokensAgg[0]?.sum || 0)
      if (runsToday + 1 > runsPerDayLimit) {
        return res.status(429).json({ error: 'Daily run limit exceeded.' })
      }
      if (tokensToday + maxOutputTokens > tokensPerDayLimit) {
        return res.status(429).json({ error: 'Daily token limit exceeded.' })
      }
    }

    if (teamId && !req.user) {
      return res.status(401).json({ error: 'Authentication required for team.' })
    }
    if (teamId && req.user) {
      const member = await isMemberOfTeam(req.user._id, teamId)
      if (!member) {
        return res.status(403).json({ error: 'Not a team member.' })
      }
    }

    if (workspaceId && !req.user) {
      return res
        .status(401)
        .json({ error: 'Authentication required for workspace.' })
    }
    if (workspaceId && req.user) {
      const workspace = await Workspace.findById(workspaceId)
      if (!workspace) {
        return res.status(400).json({ error: 'Workspace not found.' })
      }
      if (
        workspace.ownerId?.toString() !== req.user._id.toString() &&
        !(await isMemberOfTeam(req.user._id, workspace.teamId))
      ) {
        return res.status(403).json({ error: 'No workspace access.' })
      }
    }

    let assignmentContext = ''
    let resolvedAssignmentId = null
    let integrityMode = Boolean(options.integrityMode)

    if (assignmentId && !req.user) {
      return res
        .status(401)
        .json({ error: 'Authentication required for assignment.' })
    }

    if (assignmentId) {
      const assignment = await Assignment.findById(assignmentId)
      if (!assignment) {
        return res.status(400).json({ error: 'Assignment not found.' })
      }
      if (assignment.teamId) {
        const member = await isMemberOfTeam(req.user?._id, assignment.teamId)
        if (!member) {
          return res.status(403).json({ error: 'No assignment access.' })
        }
      } else if (
        req.user &&
        assignment.createdBy.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ error: 'No assignment access.' })
      }
      assignmentContext = buildAssignmentContext(assignment)
      resolvedAssignmentId = assignment._id
      integrityMode =
        typeof options.integrityMode === 'boolean'
          ? options.integrityMode
          : Boolean(assignment.integrityMode)
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = buildPrompt({
      language,
      framework,
      includeIntegration: Boolean(options.includeIntegration),
      includeRegression: Boolean(options.includeRegression),
      integrityMode,
      assignmentContext,
      source,
    })

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      const streamResponse = await client.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        instructions: buildStreamingPrompt({
          language,
          framework,
          includeIntegration: Boolean(options.includeIntegration),
          includeRegression: Boolean(options.includeRegression),
          integrityMode,
          assignmentContext,
          source,
        }),
        input: 'Generate the test suite and analysis as requested.',
        max_output_tokens: maxOutputTokens,
        stream: true,
      })

      let outputText = ''
      let tokenEstimate = 0

      for await (const event of streamResponse) {
        if (event.type === 'response.output_text.delta') {
          outputText += event.delta || ''
          tokenEstimate += Math.ceil((event.delta || '').length / 4)
        }
        res.write(
          `data: ${JSON.stringify({
            type: event.type,
            delta: event.delta,
            token_estimate: tokenEstimate,
          })}\n\n`,
        )
      }

      const payload = parseSectionsFromMarkdown(outputText)
      if (req.user) {
        await Run.create({
          userId: req.user._id,
          language,
          framework,
          tokenEstimate,
          fileCount: files.length,
          includeIntegration: Boolean(options.includeIntegration),
          includeRegression: Boolean(options.includeRegression),
          integrityMode,
          teamId: teamId || null,
          workspaceId: workspaceId || null,
          assignmentId: resolvedAssignmentId,
        })
      }

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          language,
          framework,
          token_estimate: tokenEstimate,
          ...payload,
        })}\n\n`,
      )
      res.end()
      return
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      instructions: prompt,
      input: 'Generate the test suite and analysis as requested.',
      max_output_tokens: maxOutputTokens,
    })

    const outputText = response.output_text || ''
    let parsed = null
    try {
      parsed = JSON.parse(outputText)
    } catch {
      parsed = null
    }

    const payload = parsed || {
      coverage_analysis: [],
      untested_paths: [],
      generated_tests: outputText,
      coverage_improvement: 'Unknown (unstructured output).',
      suggested_follow_up: 'Review manually for completeness.',
    }

    if (req.user) {
      await Run.create({
        userId: req.user._id,
        language,
        framework,
        tokenEstimate: 0,
        fileCount: files.length,
        includeIntegration: Boolean(options.includeIntegration),
        includeRegression: Boolean(options.includeRegression),
        integrityMode,
        teamId: teamId || null,
        workspaceId: workspaceId || null,
        assignmentId: resolvedAssignmentId,
      })
    }

    res.json({
      language,
      framework,
      ...payload,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate tests.',
      detail: error?.message || String(error),
    })
  }
})

app.post('/api/export', async (req, res) => {
  try {
    const { content, targetPath } = req.body || {}
    if (!content) {
      return res.status(400).json({ error: 'No content provided.' })
    }

    const safeTarget =
      targetPath && targetPath.trim()
        ? path.resolve(workspaceRoot, targetPath.trim())
        : path.join(exportsDir, `generated-tests-${Date.now()}.txt`)

    if (!safeTarget.startsWith(workspaceRoot)) {
      return res.status(400).json({ error: 'Invalid export path.' })
    }

    await fs.mkdir(path.dirname(safeTarget), { recursive: true })
    await fs.writeFile(safeTarget, content, 'utf8')

    res.json({ path: safeTarget })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export tests.',
      detail: error?.message || String(error),
    })
  }
})

app.post('/api/diff', async (req, res) => {
  try {
    const { existingPath, existingContent, newContent } = req.body || {}
    if (!newContent) {
      return res.status(400).json({ error: 'No new content provided.' })
    }

    let baseline = existingContent || ''
    if (!baseline && existingPath) {
      const resolved = path.resolve(workspaceRoot, existingPath)
      if (!resolved.startsWith(workspaceRoot)) {
        return res.status(400).json({ error: 'Invalid diff path.' })
      }
      baseline = await fs.readFile(resolved, 'utf8')
    }

    const diffText = createTwoFilesPatch(
      existingPath || 'existing-tests',
      'generated-tests',
      baseline,
      newContent,
      undefined,
      undefined,
      { context: 3 },
    )

    res.json({ diff: diffText })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to compute diff.',
      detail: error?.message || String(error),
    })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
