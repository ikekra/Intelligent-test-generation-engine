import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './App.css'

const starterInput = `LANGUAGE: Python
FRAMEWORK: PyTest
CODE:
\`\`\`python
def normalize_email(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = value.strip().lower()
    if "@" not in cleaned:
        raise ValueError("invalid email")
    return cleaned
\`\`\`
EXISTING TESTS:
\`\`\`
NONE
\`\`\`
CONTEXT: Used during signup and password resets.`

const generatedTestBlock = `import pytest

from app.email_utils import normalize_email

def test_normalize_email__valid_email__lowercases_and_trims():
    assert normalize_email("  Alice@Example.Com ") == "alice@example.com"

def test_normalize_email__null_input__returns_empty_string():
    assert normalize_email(None) == ""

def test_normalize_email__missing_at_symbol__raises_value_error():
    with pytest.raises(ValueError):
        normalize_email("alice.example.com")

def test_normalize_email__already_clean__returns_same_value():
    assert normalize_email("dev@team.io") == "dev@team.io"`

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const saved = loadSettings()
  const [input, setInput] = useState(saved.input || starterInput)
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasResults, setHasResults] = useState(true)
  const [includeIntegration, setIncludeIntegration] = useState(
    saved.includeIntegration ?? true,
  )
  const [includeRegression, setIncludeRegression] = useState(
    saved.includeRegression ?? true,
  )
  const [files, setFiles] = useState([])
  const [language, setLanguage] = useState(saved.language || 'Python')
  const [framework, setFramework] = useState(saved.framework || 'PyTest')
  const [result, setResult] = useState({
    coverage_analysis: [
      { function: 'normalize_email', risk: 'HIGH' },
      { function: 'normalize_email', risk: 'MEDIUM' },
      { function: 'normalize_email', risk: 'LOW' },
    ],
    untested_paths: [
      'Null input returns empty string',
      'Missing @ symbol throws ValueError',
      'Whitespace trimming for already valid emails',
    ],
    generated_tests: generatedTestBlock,
    coverage_improvement: 'Adds ~36% branch coverage to this module.',
    suggested_follow_up:
      'Confirm business rules around email aliases and disposable domains before finalizing.',
  })
  const [diffText, setDiffText] = useState('')
  const [existingPath, setExistingPath] = useState(saved.existingPath || '')
  const [exportPath, setExportPath] = useState(
    saved.exportPath || 'exports/generated-tests.py',
  )
  const [error, setError] = useState('')
  const [streamText, setStreamText] = useState('')
  const [tokenEstimate, setTokenEstimate] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [includePatterns, setIncludePatterns] = useState(
    saved.includePatterns || '',
  )
  const [excludePatterns, setExcludePatterns] = useState(
    saved.excludePatterns || 'node_modules,dist,build',
  )
  const [preset, setPreset] = useState(saved.preset || 'python-pytest')
  const [fileOverrides, setFileOverrides] = useState(saved.fileOverrides || {})
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [teams, setTeams] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [invites, setInvites] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(
    saved.selectedTeamId || '',
  )
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    saved.selectedWorkspaceId || '',
  )
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [lastInviteToken, setLastInviteToken] = useState('')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('')
  const [adminAudit, setAdminAudit] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    saved.selectedAssignmentId || '',
  )
  const [teamRole, setTeamRole] = useState('')
  const [teamDashboard, setTeamDashboard] = useState(null)
  const [reportStatus, setReportStatus] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [workItems, setWorkItems] = useState([])
  const [workStatus, setWorkStatus] = useState('')
  const [adminUsers, setAdminUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileMajor, setProfileMajor] = useState('')
  const [profileYear, setProfileYear] = useState('')
  const [profileUniversity, setProfileUniversity] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [profileStatus, setProfileStatus] = useState('')
  const [comments, setComments] = useState([])
  const [commentDraft, setCommentDraft] = useState('')
  const [versions, setVersions] = useState([])
  const [versionLabel, setVersionLabel] = useState('')
  const [teamActivity, setTeamActivity] = useState([])
  const [usage, setUsage] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('')
  const [newAssignmentCourse, setNewAssignmentCourse] = useState('')
  const [newAssignmentDue, setNewAssignmentDue] = useState('')
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('')
  const [newAssignmentRubric, setNewAssignmentRubric] = useState('')
  const [assignmentTemplate, setAssignmentTemplate] = useState('dsa')
  const [rubricPreset, setRubricPreset] = useState('balanced')
  const [integrityMode, setIntegrityMode] = useState(
    saved.integrityMode ?? true,
  )
  const [studyMode, setStudyMode] = useState(saved.studyMode ?? false)

  const coverage = useMemo(() => {
    if (!hasResults) {
      return { before: 42, after: 78, delta: 36 }
    }
    const match = result?.coverage_improvement?.match(/(\d+)%/)
    const delta = match ? Number(match[1]) : 36
    return { before: 42, after: 42 + delta, delta }
  }, [hasResults, result])

  const liveSections = useMemo(
    () => parseSectionsFromMarkdown(streamText),
    [streamText],
  )

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item._id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId],
  )

  const canTeacherView = ['owner', 'admin', 'teacher'].includes(teamRole)
  const activePage = location.pathname.startsWith('/app/')
    ? location.pathname.slice(5)
    : 'dashboard'

  const pageMeta = {
    dashboard: {
      eyebrow: 'Dashboard',
      title: 'Your assignment test workspace.',
      subtitle: 'Track runs, assignments, and team activity in one view.',
    },
    teams: {
      eyebrow: 'Teams',
      title: 'Collaborate with your project group.',
      subtitle: 'Invite teammates and manage roles for the course project.',
    },
    assignments: {
      eyebrow: 'Assignments',
      title: 'Create assignment contexts and rubrics.',
      subtitle: 'Use templates to keep test generation aligned to course goals.',
    },
    workspace: {
      eyebrow: 'Workspace',
      title: 'Generate tests that respect academic integrity.',
      subtitle: 'Upload code, review coverage, and export test suites.',
    },
    teacher: {
      eyebrow: 'Teacher',
      title: 'Review team usage and activity.',
      subtitle: 'Monitor runs and assignments at the team level.',
    },
    admin: {
      eyebrow: 'Admin',
      title: 'Audit platform activity.',
      subtitle: 'Review users, runs, and assignments across the platform.',
    },
    users: {
      eyebrow: 'Users',
      title: 'Manage user accounts.',
      subtitle: 'Search, filter, and review registered users.',
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Your account settings.',
      subtitle: 'Update your name and password.',
    },
    billing: {
      eyebrow: 'Plans',
      title: 'Student-first pricing.',
      subtitle: 'Upgrade when you need more usage and exports.',
    },
  }

  const isAppRoute = location.pathname.startsWith('/app/')

  const showTeamsPage = activePage === 'teams'
  const showAssignmentsPage = activePage === 'assignments'
  const showWorkspacePage = activePage === 'workspace'
  const showTeamGroup = showTeamsPage || showAssignmentsPage || showWorkspacePage

  const onboardingSteps = [
    { id: 'account', label: 'Create account', done: Boolean(user) },
    { id: 'assignment', label: 'Create assignment', done: assignments.length > 0 },
    { id: 'workspace', label: 'Create workspace', done: workspaces.length > 0 },
    { id: 'run', label: 'Generate tests', done: (dashboard?.totalRuns || 0) > 0 },
    { id: 'save', label: 'Save work', done: workItems.length > 0 },
  ]
  const completedSteps = onboardingSteps.filter((step) => step.done).length
  const onboardingProgress = Math.round(
    (completedSteps / onboardingSteps.length) * 100,
  )

  useEffect(() => {
    if (user && location.pathname === '/') {
      navigate('/app/dashboard')
    }
    if (!user && location.pathname.startsWith('/app/')) {
      navigate('/')
    }
  }, [user, location.pathname, navigate])

  useEffect(() => {
    if (location.pathname === '/login') {
      setAuthMode('login')
    }
    if (location.pathname === '/signup') {
      setAuthMode('register')
    }
    setNavOpen(false)
  }, [location.pathname])

  useLocalStorageSync({
    input,
    includeIntegration,
    includeRegression,
    studyMode,
    language,
    framework,
    includePatterns,
    excludePatterns,
    preset,
    exportPath,
    existingPath,
    fileOverrides,
    selectedTeamId,
    selectedWorkspaceId,
    selectedAssignmentId,
    integrityMode,
  })

  useEffect(() => {
    loadMe()
  }, [])

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileMajor(user.major || '')
      setProfileYear(user.year || '')
      setProfileUniversity(user.university || '')
      setProfileBio(user.bio || '')
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadComments()
      loadVersions()
      if (selectedTeamId && canTeacherView) loadTeamActivity(selectedTeamId)
    }
  }, [user, selectedTeamId, selectedAssignmentId, selectedWorkspaceId])

  if (!authChecked) {
    return null
  }
  if (user && (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup')) {
    return <Navigate to="/app/dashboard" replace />
  }
  if (!user && isAppRoute) {
    return <Navigate to="/" replace />
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    setDiffText('')
    setStreamText('')
    setTokenEstimate(0)
    setIsStreaming(true)
    try {
      const filteredFiles = applyFilters(
        files,
        includePatterns,
        excludePatterns,
        fileOverrides,
      )
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          input,
          files: filteredFiles,
          language,
          framework,
          teamId: selectedTeamId || null,
          workspaceId: selectedWorkspaceId || null,
          assignmentId: selectedAssignmentId || null,
          options: {
            includeIntegration,
            includeRegression,
            integrityMode,
          },
          stream: true,
        }),
      })
      if (!response.ok || !response.body) {
        const data = await response.json()
        throw new Error(data.error || 'Generation failed.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const payload = JSON.parse(line.replace('data:', '').trim())

          if (payload.type === 'response.output_text.delta') {
            setStreamText((prev) => prev + (payload.delta || ''))
            setTokenEstimate(payload.token_estimate || 0)
          }

          if (payload.type === 'done') {
            setResult(payload)
            setHasResults(true)
            setIsStreaming(false)
            if (user) {
              loadDashboard()
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Generation failed.')
    } finally {
      setIsGenerating(false)
      setIsStreaming(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result?.generated_tests || '')
  }

  const handleExport = async () => {
    setError('')
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: result?.generated_tests || '',
          targetPath: exportPath,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Export failed.')
      }
      setExportPath(data.path)
    } catch (err) {
      setError(err.message || 'Export failed.')
    }
  }

  const handleDiff = async () => {
    setError('')
    try {
      const response = await fetch('/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          existingPath,
          newContent: result?.generated_tests || '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Diff failed.')
      }
      setDiffText(data.diff || '')
    } catch (err) {
      setError(err.message || 'Diff failed.')
    }
  }

  const handleFiles = async (event) => {
    const selected = Array.from(event.target.files || [])
    const readFiles = await Promise.all(
      selected.map(async (file) => {
        const content = await file.text()
        return { name: file.webkitRelativePath || file.name, content }
      }),
    )
    setFiles(readFiles)
    setFileOverrides({})
    const detected = detectLanguageFromFiles(readFiles)
    setLanguage(detected)
    setFramework(defaultFrameworkByLanguage[detected] || 'Jest')
  }

  const applyPreset = (value) => {
    setPreset(value)
    const presetData = presets.find((item) => item.id === value)
    if (!presetData) return
    setLanguage(presetData.language)
    setFramework(presetData.framework)
    setInput(presetData.template)
  }

  const toggleFileOverride = (name, checked) => {
    setFileOverrides((prev) => ({
      ...prev,
      [name]: checked,
    }))
  }

  const clearOverridesForFolder = (path) => {
    setFileOverrides((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        if (key === path || key.startsWith(`${path}/`)) {
          delete next[key]
        }
      })
      return next
    })
  }

  const loadMe = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setUser(data)
      loadDashboard()
      loadTeams()
      loadWorkspaces()
      loadInvites()
      loadAssignments()
      if (data.isAdmin) {
        loadAdminAudit()
        loadAdminUsers()
      }
      if (selectedTeamId) loadMembers(selectedTeamId)
    } catch {
      setUser(null)
    } finally {
      setAuthChecked(true)
    }
  }

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setDashboard(data)
      setWorkItems(data.recentWork || [])
      setUsage(data.usage || null)
    } catch {
      setDashboard(null)
    }
  }

  const loadWorkItems = async () => {
    try {
      const response = await fetch('/api/work', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      setWorkItems(data.work || [])
    } catch {
      setWorkItems([])
    }
  }

  const loadComments = async () => {
    try {
      const query = selectedTeamId
        ? `?teamId=${selectedTeamId}`
        : selectedAssignmentId
          ? `?assignmentId=${selectedAssignmentId}`
          : ''
      const response = await fetch(`/api/comments${query}`, {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setComments(data.comments || [])
    } catch {
      setComments([])
    }
  }

  const loadVersions = async () => {
    try {
      const query = selectedWorkspaceId
        ? `?workspaceId=${selectedWorkspaceId}`
        : selectedAssignmentId
          ? `?assignmentId=${selectedAssignmentId}`
          : ''
      const response = await fetch(`/api/versions${query}`, {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setVersions(data.versions || [])
    } catch {
      setVersions([])
    }
  }

  const loadTeamActivity = async (teamId) => {
    if (!teamId) {
      setTeamActivity([])
      return
    }
    try {
      const response = await fetch(`/api/teams/${teamId}/activity`, {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setTeamActivity(data.activity || [])
    } catch {
      setTeamActivity([])
    }
  }

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/teams', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      setTeams(data.teams || [])
    } catch {
      setTeams([])
    }
  }

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      setWorkspaces(data.workspaces || [])
    } catch {
      setWorkspaces([])
    }
  }

  const loadTeamRole = async (teamId) => {
    if (!teamId) {
      setTeamRole('')
      return
    }
    try {
      const response = await fetch(`/api/teams/${teamId}/role`, {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setTeamRole(data.role || '')
    } catch {
      setTeamRole('')
    }
  }

  const loadTeamDashboard = async (teamId) => {
    if (!teamId) {
      setTeamDashboard(null)
      return
    }
    try {
      const response = await fetch(`/api/teams/${teamId}/dashboard`, {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setTeamDashboard(data)
    } catch {
      setTeamDashboard(null)
    }
  }

  const loadAssignments = async (teamIdOverride) => {
    try {
      const query = teamIdOverride || selectedTeamId
      const response = await fetch(
        `/api/assignments${query ? `?teamId=${query}` : ''}`,
        { credentials: 'include' },
      )
      if (!response.ok) return
      const data = await response.json()
      setAssignments(data.assignments || [])
    } catch {
      setAssignments([])
    }
  }

  const loadMembers = async (teamId) => {
    if (!teamId) {
      setTeamMembers([])
      return
    }
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setTeamMembers(data.members || [])
    } catch {
      setTeamMembers([])
    }
  }

  const loadInvites = async () => {
    try {
      const response = await fetch('/api/teams/invites', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setInvites(data.invites || [])
    } catch {
      setInvites([])
    }
  }

  const loadAdminAudit = async () => {
    try {
      const response = await fetch('/api/admin/audit', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setAdminAudit(data)
    } catch {
      setAdminAudit(null)
    }
  }

  const loadAdminUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      setAdminUsers(data.users || [])
    } catch {
      setAdminUsers([])
    }
  }

  const handleAuth = async ({ mode, email, password, name }) => {
    setAuthError('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setAuthError('Email and password are required.')
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      setAuthError('Invalid email format.')
      return
    }
    if (!isValidPassword(password)) {
      setAuthError('Password must be at least 8 characters.')
      return
    }
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload =
        mode === 'login'
          ? { email: normalizedEmail, password }
          : { email: normalizedEmail, password, name }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || data.detail || 'Auth failed.')
      setUser(data)
      loadDashboard()
      loadTeams()
      loadWorkspaces()
      loadInvites()
      if (data.isAdmin) {
        loadAdminAudit()
        loadAdminUsers()
      }
      navigate('/app/dashboard')
    } catch (err) {
      setAuthError(err.message || 'Auth failed.')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setDashboard(null)
    setTeams([])
    setWorkspaces([])
    setInvites([])
    setAdminAudit(null)
    setAssignments([])
    setSelectedAssignmentId('')
    setTeamRole('')
    setTeamDashboard(null)
    navigate('/')
  }

  const handleResetUi = () => {
    localStorage.removeItem(SETTINGS_KEY)
    window.location.reload()
  }

  const handleCreateTeam = async () => {
    if (!newTeamName) return
    const response = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newTeamName }),
    })
    if (response.ok) {
      setNewTeamName('')
      loadTeams()
    }
  }

  const handleInvite = async () => {
    if (!selectedTeamId || !inviteEmail) return
    const response = await fetch(`/api/teams/${selectedTeamId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: inviteEmail }),
    })
    if (response.ok) {
      const data = await response.json()
      setLastInviteToken(data.inviteToken || '')
      setInviteEmail('')
    }
  }

  const handleAcceptInvite = async (token) => {
    const response = await fetch('/api/teams/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
    if (response.ok) {
      loadInvites()
      loadTeams()
    }
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName) return
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: newWorkspaceName,
        description: newWorkspaceDesc,
        teamId: selectedTeamId || null,
        assignmentId: selectedAssignmentId || null,
      }),
    })
    if (response.ok) {
      setNewWorkspaceName('')
      setNewWorkspaceDesc('')
      loadWorkspaces()
    }
  }

  const handleCreateAssignment = async () => {
    if (!newAssignmentTitle) return
    const response = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: newAssignmentTitle,
        course: newAssignmentCourse,
        dueDate: newAssignmentDue || null,
        description: newAssignmentDesc,
        rubric: newAssignmentRubric,
        teamId: selectedTeamId || null,
        integrityMode,
      }),
    })
    if (response.ok) {
      setNewAssignmentTitle('')
      setNewAssignmentCourse('')
      setNewAssignmentDue('')
      setNewAssignmentDesc('')
      setNewAssignmentRubric('')
      setAssignmentTemplate('dsa')
      setRubricPreset('balanced')
      loadAssignments()
    }
  }

  const handleDeleteAssignment = async (assignmentId) => {
    if (!assignmentId) return
    await fetch(`/api/assignments/${assignmentId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (selectedAssignmentId === assignmentId) {
      setSelectedAssignmentId('')
    }
    loadAssignments()
  }

  const handleExportAssignmentReport = async (assignmentId, format) => {
    if (!assignmentId) return
    setReportStatus('Exporting report...')
    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/report?format=${format}`,
        { credentials: 'include' },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Export failed.')
      setReportStatus(`Report saved to ${data.path}`)
    } catch (err) {
      setReportStatus(err.message || 'Export failed.')
    }
  }

  const handleSaveWork = async () => {
    if (!result?.generated_tests) {
      setWorkStatus('No generated tests to save.')
      return
    }
    setWorkStatus('Saving...')
    try {
      const response = await fetch('/api/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: selectedAssignment?.title || 'Generated test suite',
          content: result.generated_tests,
          language,
          framework,
          teamId: selectedTeamId || null,
          assignmentId: selectedAssignmentId || null,
          workspaceId: selectedWorkspaceId || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Save failed.')
      setWorkStatus('Saved to your library.')
      loadWorkItems()
    } catch (err) {
      setWorkStatus(err.message || 'Save failed.')
    }
  }

  const handleProfileSave = async () => {
    setProfileStatus('Saving...')
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: profileName,
          major: profileMajor,
          year: profileYear,
          university: profileUniversity,
          bio: profileBio,
          password: profilePassword || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Update failed.')
      setUser(data)
      setProfilePassword('')
      setProfileStatus('Profile updated.')
    } catch (err) {
      setProfileStatus(err.message || 'Update failed.')
    }
  }

  const handleAddComment = async () => {
    if (!commentDraft.trim()) return
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: commentDraft.trim(),
          teamId: selectedTeamId || null,
          assignmentId: selectedAssignmentId || null,
          workspaceId: selectedWorkspaceId || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Comment failed.')
      setCommentDraft('')
      loadComments()
    } catch (err) {
      setCommentDraft(err.message || 'Comment failed.')
    }
  }

  const handleSaveVersion = async () => {
    if (!versionLabel.trim() || !result?.generated_tests) return
    try {
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          label: versionLabel.trim(),
          content: result.generated_tests,
          teamId: selectedTeamId || null,
          assignmentId: selectedAssignmentId || null,
          workspaceId: selectedWorkspaceId || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Version save failed.')
      setVersionLabel('')
      loadVersions()
    } catch (err) {
      setVersionLabel(err.message || 'Version save failed.')
    }
  }

  const handleSaveWorkspace = async () => {
    if (!selectedWorkspaceId) return
    await fetch(`/api/workspaces/${selectedWorkspaceId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        state: {
          input,
          includeIntegration,
          includeRegression,
          integrityMode,
          language,
          framework,
          includePatterns,
          excludePatterns,
          preset,
          fileOverrides,
          selectedAssignmentId,
        },
        fileList: files.map((file) => file.name),
      }),
    })
  }

  const handleLoadWorkspace = async (workspaceId) => {
    if (!workspaceId) return
    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      credentials: 'include',
    })
    if (!response.ok) return
    const data = await response.json()
    const state = data.state || {}
    if (state.input) setInput(state.input)
    if (state.includeIntegration !== undefined)
      setIncludeIntegration(state.includeIntegration)
    if (state.includeRegression !== undefined)
      setIncludeRegression(state.includeRegression)
    if (state.integrityMode !== undefined)
      setIntegrityMode(state.integrityMode)
    if (state.studyMode !== undefined) setStudyMode(state.studyMode)
    if (state.language) setLanguage(state.language)
    if (state.framework) setFramework(state.framework)
    if (state.includePatterns !== undefined)
      setIncludePatterns(state.includePatterns)
    if (state.excludePatterns !== undefined)
      setExcludePatterns(state.excludePatterns)
    if (state.preset) setPreset(state.preset)
    if (state.fileOverrides) setFileOverrides(state.fileOverrides)
    if (state.selectedAssignmentId)
      setSelectedAssignmentId(state.selectedAssignmentId)
  }

  const handleMemberRole = async (memberId, role) => {
    if (!selectedTeamId) return
    await fetch(`/api/teams/${selectedTeamId}/members/${memberId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    })
    loadMembers(selectedTeamId)
  }

  const handleRemoveMember = async (memberId) => {
    if (!selectedTeamId) return
    await fetch(`/api/teams/${selectedTeamId}/members/${memberId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    loadMembers(selectedTeamId)
  }

  const AuthForm = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')

    useEffect(() => {
      setPassword('')
    }, [authMode])

    return (
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault()
          handleAuth({ mode: authMode, email, password, name })
        }}
      >
        <div className="button-row">
          <button
            type="button"
            className={`ghost small ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => setAuthMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`ghost small ${authMode === 'register' ? 'active' : ''}`}
            onClick={() => setAuthMode('register')}
          >
            Register
          </button>
        </div>
        {authMode === 'register' && (
          <label>
            Name
            <input
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            placeholder="you@school.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            placeholder="Minimum 8 characters"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              authMode === 'login' ? 'current-password' : 'new-password'
            }
          />
        </label>
        <button className="primary" type="submit">
          {authMode === 'login' ? 'Login' : 'Create account'}
        </button>
        {authError && <div className="error">{authError}</div>}
        <p className="hint">
          {authMode === 'login' ? (
            <Link to="/signup">Need an account? Create one</Link>
          ) : (
            <Link to="/login">Already have an account? Login</Link>
          )}
        </p>
      </form>
    )
  }

  const authPanel = (
    <div className="panel auth-panel">
      <div className="panel-header">
        <div>
          <h2>{user ? 'Account' : 'Sign in'}</h2>
          <p>{user ? 'Manage your workspace' : 'Access your student dashboard'}</p>
        </div>
        <span className="status">{user ? 'Active' : 'Guest'}</span>
      </div>
      {user ? (
        <div className="account-body">
          <div>
            <p className="label">Signed in as</p>
            <h3>{user.email}</h3>
          </div>
          <div className="button-row">
            <button className="ghost" onClick={handleResetUi}>
              Reset UI
            </button>
            <button className="ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      ) : (
        <AuthForm />
      )}
    </div>
  )

  const AuthPage = () => (
    <div className="auth-page">
      <div className="auth-left">
        <div className="brand">
          <span className="logo-dot"></span>
          Student Test Studio
        </div>
        <h1>Ship tests that feel instructor‑ready.</h1>
        <p>
          Built for students. Generate rubric‑aligned tests, collaborate with
          your team, and keep integrity intact.
        </p>
        <div className="auth-bullets">
          <div>Rubric‑aligned test generation</div>
          <div>Team workspaces and comments</div>
          <div>Teacher reports and audit trails</div>
        </div>
      </div>
      <div className="auth-right">{authPanel}</div>
    </div>
  )

  if (!user) {
    if (location.pathname === '/login' || location.pathname === '/signup') {
      return <AuthPage />
    }
    return (
      <div className="app landing">
        <nav className="top-nav">
          <div className="brand">
            <span className="logo-dot"></span>
            Student Test Studio
          </div>
          <div className="nav-actions">
            <Link className="ghost small button-link" to="/login">
              Login
            </Link>
            <Link className="primary button-link" to="/signup">
              Start free
            </Link>
          </div>
        </nav>

        <header className="hero landing-hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">Student SaaS Studio</div>
            <h1>Generate assignment-ready tests in minutes, not nights.</h1>
            <p className="hero-subtitle">
              Built by a student, for students. Turn your code into disciplined
              test suites, collaborate with your project team, and keep academic
              integrity intact.
            </p>
            <div className="hero-actions">
              <Link className="primary button-link" to="/signup">
                Start free
              </Link>
              <Link className="ghost button-link" to="/login">
                Login
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <span className="stat-value">+36%</span>
                <span className="stat-label">Coverage lift</span>
              </div>
              <div>
                <span className="stat-value">6</span>
                <span className="stat-label">Assignment templates</span>
              </div>
              <div>
                <span className="stat-value">2m</span>
                <span className="stat-label">Average time to suite</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="panel">
              <h3>Get started fast</h3>
              <p className="hint">
                Create an account to save runs, track progress, and export reports.
              </p>
              <div className="button-row">
                <Link className="primary button-link" to="/signup">
                  Create account
                </Link>
                <Link className="ghost button-link" to="/login">
                  Login
                </Link>
              </div>
            </div>
          </div>
        </header>

        <section className="trust">
          <div className="trust-label">Used in student projects across</div>
          <div className="trust-row">
            <span>CS101</span>
            <span>Data Structures</span>
            <span>OOP</span>
            <span>Database Systems</span>
            <span>Software Engineering</span>
          </div>
        </section>

        <section className="features">
          <div className="feature-card">
            <h3>Rubric-aligned tests</h3>
            <p>Generate suites mapped to instructor expectations.</p>
          </div>
          <div className="feature-card">
            <h3>Team collaboration</h3>
            <p>Shared workspaces, invites, and visibility for group work.</p>
          </div>
          <div className="feature-card">
            <h3>Integrity-first</h3>
            <p>Plagiarism-safe guidance and black-box testing prompts.</p>
          </div>
        </section>

        <section className="how">
          <div className="how-copy">
            <h2>How it works</h2>
            <p>
              A clean, student-friendly workflow that turns a messy assignment
              into an organized test suite.
            </p>
          </div>
          <div className="how-steps">
            <div className="panel">
              <h3>1. Create assignment</h3>
              <p>Pick a template, add rubric focus, and set due dates.</p>
            </div>
            <div className="panel">
              <h3>2. Upload or paste code</h3>
              <p>Bring in your project files and context in one shot.</p>
            </div>
            <div className="panel">
              <h3>3. Generate & save</h3>
              <p>Export tests, save to your library, and share with your team.</p>
            </div>
          </div>
        </section>

        <section className="student-focus">
          <div className="panel highlight">
            <h2>Built for students</h2>
            <p>
              Clear feedback, progress-focused dashboards, and workflows tuned
              for deadlines, labs, and group submissions.
            </p>
          </div>
          <div className="panel">
            <h3>Teacher-ready reporting</h3>
            <p>Assignment reports and audit trails for instructors.</p>
          </div>
        </section>

        <section className="pricing">
          <div>
            <h2>Student-first</h2>
            <p>Built by students, for students.</p>
          </div>
          <div className="pricing-grid">
            <div className="panel">
              <h3>Solo</h3>
              <p className="price">Free</p>
              <p>Personal workspace and assignment presets.</p>
            </div>
            <div className="panel highlight">
              <h3>Project Team</h3>
              <p className="price">Free</p>
              <p>Team workspaces, shared runs, and teacher visibility.</p>
            </div>
            <div className="panel">
              <h3>Campus</h3>
              <p className="price">Pilot</p>
              <p>Department-wide usage limits and dashboards.</p>
            </div>
          </div>
        </section>

        <section className="faq">
          <div className="panel">
            <h2>FAQ</h2>
            <div className="faq-grid">
              <div>
                <h4>Is this allowed for assignments?</h4>
                <p>
                  Use it for testing, not for writing solutions. Integrity mode
                  keeps guidance aligned to course rules.
                </p>
              </div>
              <div>
                <h4>Can I work with my group?</h4>
                <p>Yes. Invite teammates and share a workspace.</p>
              </div>
              <div>
                <h4>Do instructors get reports?</h4>
                <p>Yes. Export assignment reports from the teacher dashboard.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>Student Test Studio</span>
          <span>Built by students for students</span>
        </footer>
      </div>
    )
  }

  return (
    <div className="app app-shell">
      <nav className="top-nav">
        <div className="brand">
          <span className="logo-dot"></span>
          Student Test Studio
        </div>
        <div className={`nav-links ${navOpen ? 'open' : ''}`}>
          <Link
            className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}
            to="/app/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className={`nav-link ${activePage === 'teams' ? 'active' : ''}`}
            to="/app/teams"
          >
            Teams
          </Link>
          <Link
            className={`nav-link ${activePage === 'assignments' ? 'active' : ''}`}
            to="/app/assignments"
          >
            Assignments
          </Link>
          <Link
            className={`nav-link ${activePage === 'workspace' ? 'active' : ''}`}
            to="/app/workspace"
          >
            Workspace
          </Link>
          <Link
            className={`nav-link ${activePage === 'profile' ? 'active' : ''}`}
            to="/app/profile"
          >
            Profile
          </Link>
          <Link
            className={`nav-link ${activePage === 'billing' ? 'active' : ''}`}
            to="/app/billing"
          >
            Plans
          </Link>
          {canTeacherView && (
            <Link
              className={`nav-link ${activePage === 'teacher' ? 'active' : ''}`}
              to="/app/teacher"
            >
              Teacher
            </Link>
          )}
          {user?.isAdmin && (
            <Link
              className={`nav-link ${activePage === 'admin' ? 'active' : ''}`}
              to="/app/admin"
            >
              Admin
            </Link>
          )}
          {user?.isAdmin && (
            <Link
              className={`nav-link ${activePage === 'users' ? 'active' : ''}`}
              to="/app/users"
            >
              Users
            </Link>
          )}
        </div>
        <div className="nav-actions">
          <button
            className="ghost small nav-toggle"
            onClick={() => setNavOpen((prev) => !prev)}
          >
            {navOpen ? 'Close' : 'Menu'}
          </button>
          <button className="ghost small" onClick={handleResetUi}>
            Reset UI
          </button>
          <div className="profile">
            <button
              className="ghost small"
              onClick={() => setProfileOpen((prev) => !prev)}
            >
              {user?.name || user?.email || 'Profile'}
            </button>
            {profileOpen && (
              <div className="profile-card">
                <p className="label">Account</p>
                <h4>{user?.name || 'Student'}</h4>
                <p className="hint">{user?.email}</p>
                <p className="hint">
                  Role: {user?.isAdmin ? 'Admin' : teamRole || 'Member'}
                </p>
                <p className="hint">Plan: {user?.plan || 'free'}</p>
                <Link className="ghost small" to="/app/profile">
                  Edit profile
                </Link>
                <button className="ghost small" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-group">
            <h4>Workspace</h4>
            <p>{selectedWorkspaceId ? 'Active workspace' : 'No workspace'}</p>
          </div>
          <div className="sidebar-group">
            <h4>Team</h4>
            <p>{selectedTeamId ? 'Team scope' : 'Personal scope'}</p>
          </div>
          <div className="sidebar-group">
            <h4>Assignment</h4>
            <p>{selectedAssignmentId ? 'Assignment linked' : 'No assignment'}</p>
          </div>
          {canTeacherView && (
            <div className="sidebar-group">
              <h4>Teacher</h4>
              <p>Teacher mode enabled</p>
            </div>
          )}
          <div className="sidebar-group">
            <h4>Usage</h4>
            <p>{tokenEstimate} tokens (latest)</p>
          </div>
        </aside>

        <main className="shell-main">
          <header className="hero">
            <div className="hero-eyebrow">
              {(pageMeta[activePage] || pageMeta.dashboard).eyebrow}
            </div>
            <h1>{(pageMeta[activePage] || pageMeta.dashboard).title}</h1>
            <p className="hero-subtitle">
              {(pageMeta[activePage] || pageMeta.dashboard).subtitle}
            </p>
          </header>

      {activePage === 'dashboard' && (
        <section className="account">
          {authPanel}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Live dashboard</h2>
                <p>Track your runs and coverage gains.</p>
              </div>
              <span className="status">{user ? 'Live' : 'Locked'}</span>
            </div>
            {user && dashboard ? (
              <div className="dashboard">
                <div className="card onboarding">
                      <div>
                        <h4>Getting started</h4>
                        <p className="hint">
                          Complete these steps to set up your first project.
                        </p>
                      </div>
                      <div className="progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${onboardingProgress}%` }}
                          ></div>
                        </div>
                        <span>{onboardingProgress}%</span>
                      </div>
                      <ul className="checklist">
                        {onboardingSteps.map((step) => (
                          <li key={step.id} className={step.done ? 'done' : ''}>
                            <span>{step.done ? '✓' : '•'}</span>
                            {step.label}
                          </li>
                        ))}
                      </ul>
                  </div>
                  {usage && (
                    <div className="card usage">
                      <h4>Daily usage</h4>
                      <div className="usage-row">
                        <span>Runs</span>
                        <span>
                          {usage.runsToday}/{usage.runsLimit}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-fill"
                          style={{
                            width: `${Math.min(
                              100,
                              (usage.runsToday / usage.runsLimit) * 100,
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <div className="usage-row">
                        <span>Tokens</span>
                        <span>
                          {usage.tokensToday}/{usage.tokensLimit}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-fill"
                          style={{
                            width: `${Math.min(
                              100,
                              (usage.tokensToday / usage.tokensLimit) * 100,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <div className="kpi-row">
                    <div className="kpi">
                      <span className="kpi-label">Runs</span>
                      <strong>{dashboard.totalRuns}</strong>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">Assignments</span>
                      <strong>{dashboard.recentAssignments?.length || 0}</strong>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">Saved work</span>
                      <strong>{dashboard.recentWork?.length || 0}</strong>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">Plan</span>
                      <strong>{user?.plan || 'free'}</strong>
                    </div>
                  </div>
                <div className="dashboard-grid">
                      <div className="card">
                        <h4>Total runs</h4>
                        <p>{dashboard.totalRuns}</p>
                      </div>
                    <div className="card">
                      <h4>Avg tokens</h4>
                      <p>{dashboard.avgTokens}</p>
                    </div>
                    <div className="card">
                      <h4>Assignments</h4>
                      <p>{dashboard.recentAssignments?.length || 0}</p>
                    </div>
                  </div>
                  <div className="card">
                    <h4>Recent runs</h4>
                    <ul>
                      {dashboard.recentRuns.map((run) => (
                        <li key={run._id}>
                          {run.language} — {run.framework} —{' '}
                          {new Date(run.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h4>Team runs</h4>
                    <ul>
                      {dashboard.teamRuns.map((run) => (
                        <li key={run._id}>
                          {run.language} — {run.framework} —{' '}
                          {new Date(run.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h4>Recent assignments</h4>
                    <ul>
                      {(dashboard.recentAssignments || []).map((assignment) => (
                        <li key={assignment._id}>
                          {assignment.title}
                          {assignment.course ? ` — ${assignment.course}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h4>My saved work</h4>
                    <ul>
                      {(dashboard.recentWork || []).map((item) => (
                        <li key={item._id}>
                          {item.title} — {new Date(item.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h4>My saved work</h4>
                    <ul>
                      {(dashboard.recentWork || []).map((item) => (
                        <li key={item._id}>
                          {item.title} — {new Date(item.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="hint">Loading dashboard…</p>
              )}
            </div>
          </section>
          )}

      {showTeamGroup && (
      <section className="account">
        {showTeamsPage && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Teams</h2>
              <p>Create teams and invite members.</p>
            </div>
            <span className="status">{user ? 'Ready' : 'Locked'}</span>
          </div>
          {user ? (
            <div className="account-form">
              <div className="field-grid">
                <label>
                  New team
                  <input
                    value={newTeamName}
                    onChange={(event) => setNewTeamName(event.target.value)}
                    placeholder="Team name"
                  />
                </label>
                <button className="primary" onClick={handleCreateTeam}>
                  Create team
                </button>
              </div>
              <label>
                Select team
                <select
                  value={selectedTeamId}
                  onChange={(event) => {
                    const teamId = event.target.value
                    setSelectedTeamId(teamId)
                    loadMembers(teamId)
                    loadAssignments(teamId)
                    loadTeamRole(teamId)
                    loadTeamDashboard(teamId)
                  }}
                >
                  <option value="">Personal</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-grid">
                <label>
                  Invite member
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="student@school.edu"
                  />
                </label>
                <button className="ghost" onClick={handleInvite}>
                  Send invite
                </button>
              </div>
              {lastInviteToken && (
                <p className="hint">Invite token: {lastInviteToken}</p>
              )}
              {invites.length > 0 && (
                <div className="card">
                  <h4>Pending invites</h4>
                  <ul>
                    {invites.map((invite) => (
                      <li key={invite._id}>
                        {invite.email}
                        <button
                          className="ghost small"
                          onClick={() => handleAcceptInvite(invite.token)}
                        >
                          Accept
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {teamMembers.length > 0 && (
                <div className="card">
                  <h4>Team members</h4>
                  <ul>
                    {teamMembers.map((member) => (
                      <li key={member._id}>
                        <span>{member.email || member.userId}</span>
                        <select
                          value={member.role}
                          onChange={(event) =>
                            handleMemberRole(member._id, event.target.value)
                          }
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="teacher">Teacher</option>
                          <option value="member">Student</option>
                        </select>
                        <button
                          className="ghost small"
                          onClick={() => handleRemoveMember(member._id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {teams.length === 0 && (
                <div className="card empty-card">
                  <h4>No teams yet</h4>
                  <p>Create a team to collaborate on group assignments.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="hint">Sign in to manage teams.</p>
          )}
        </div>
        )}

        {showWorkspacePage && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Workspaces</h2>
              <p>Save projects per user or team.</p>
            </div>
            <span className="status">{user ? 'Ready' : 'Locked'}</span>
          </div>
          {user ? (
            <div className="account-form">
              <div className="field-grid">
                <label>
                  Workspace name
                  <input
                    value={newWorkspaceName}
                    onChange={(event) => setNewWorkspaceName(event.target.value)}
                    placeholder="Payments refactor"
                  />
                </label>
                <label>
                  Description
                  <input
                    value={newWorkspaceDesc}
                    onChange={(event) => setNewWorkspaceDesc(event.target.value)}
                    placeholder="Sprint 12 test uplift"
                  />
                </label>
                <button className="primary" onClick={handleCreateWorkspace}>
                  Create workspace
                </button>
              </div>
              <label>
                Active workspace
                <select
                  value={selectedWorkspaceId}
                  onChange={(event) => {
                    setSelectedWorkspaceId(event.target.value)
                    handleLoadWorkspace(event.target.value)
                  }}
                >
                  <option value="">None</option>
                  {workspaces.map((space) => (
                    <option key={space._id} value={space._id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="ghost" onClick={handleSaveWorkspace}>
                Save workspace state
              </button>
            </div>
          ) : (
            <p className="hint">Sign in to manage workspaces.</p>
          )}
        </div>
        )}

        {showAssignmentsPage && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Assignments</h2>
              <p>Create assignment contexts for student projects.</p>
            </div>
            <span className="status">{user ? 'Ready' : 'Locked'}</span>
          </div>
          {user ? (
            <div className="account-form">
              <div className="field-grid">
                <label>
                  Title
                  <input
                    value={newAssignmentTitle}
                    onChange={(event) =>
                      setNewAssignmentTitle(event.target.value)
                    }
                    placeholder="Binary Search Tree Lab"
                  />
                </label>
                <label>
                  Course
                  <input
                    value={newAssignmentCourse}
                    onChange={(event) =>
                      setNewAssignmentCourse(event.target.value)
                    }
                    placeholder="CS201"
                  />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  Template
                  <select
                    value={assignmentTemplate}
                    onChange={(event) => {
                      const value = event.target.value
                      setAssignmentTemplate(value)
                      const template = assignmentTemplates.find(
                        (item) => item.id === value,
                      )
                      if (template) {
                        setNewAssignmentTitle(template.title)
                        setNewAssignmentDesc(template.description)
                        setNewAssignmentRubric(template.rubric)
                      }
                    }}
                  >
                    {assignmentTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rubric preset
                  <select
                    value={rubricPreset}
                    onChange={(event) => {
                      const value = event.target.value
                      setRubricPreset(value)
                      const preset = rubricPresets.find(
                        (item) => item.id === value,
                      )
                      if (preset) setNewAssignmentRubric(preset.value)
                    }}
                  >
                    {rubricPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-grid">
                <label>
                  Due date
                  <input
                    type="date"
                    value={newAssignmentDue}
                    onChange={(event) =>
                      setNewAssignmentDue(event.target.value)
                    }
                  />
                </label>
                <label>
                  Rubric focus
                  <input
                    value={newAssignmentRubric}
                    onChange={(event) =>
                      setNewAssignmentRubric(event.target.value)
                    }
                    placeholder="Edge cases, input validation"
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  className="assignment-text"
                  value={newAssignmentDesc}
                  onChange={(event) =>
                    setNewAssignmentDesc(event.target.value)
                  }
                  placeholder="Short summary of the assignment scope."
                />
              </label>
              <button className="primary" onClick={handleCreateAssignment}>
                Create assignment
              </button>
              <label>
                Active assignment
                <select
                  value={selectedAssignmentId}
                  onChange={(event) => setSelectedAssignmentId(event.target.value)}
                >
                  <option value="">None</option>
                  {assignments.map((assignment) => (
                    <option key={assignment._id} value={assignment._id}>
                      {assignment.title}
                    </option>
                  ))}
                </select>
              </label>
              {reportStatus && <p className="hint">{reportStatus}</p>}
              {assignments.length > 0 && (
                <div className="card">
                  <h4>Assignments</h4>
                  <ul>
                    {assignments.map((assignment) => (
                      <li key={assignment._id}>
                        <span>
                          {assignment.title}
                          {assignment.course ? ` (${assignment.course})` : ''}
                        </span>
                        <div className="button-row">
                          <button
                            className="ghost small"
                            onClick={() =>
                              handleExportAssignmentReport(
                                assignment._id,
                                'json',
                              )
                            }
                          >
                            Export JSON
                          </button>
                          <button
                            className="ghost small"
                            onClick={() =>
                              handleExportAssignmentReport(
                                assignment._id,
                                'csv',
                              )
                            }
                          >
                            Export CSV
                          </button>
                          <button
                            className="ghost small"
                            onClick={() => handleDeleteAssignment(assignment._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {assignments.length === 0 && (
                <div className="card empty-card">
                  <h4>No assignments yet</h4>
                  <p>
                    Choose a template and create your first assignment to unlock
                    rubric-based test generation.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="hint">Sign in to manage assignments.</p>
          )}
        </div>
        )}
      </section>
      )}

      {activePage === 'teacher' && selectedTeamId && canTeacherView && (
        <section className="account">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Team teacher dashboard</h2>
                <p>Assignment usage and team activity.</p>
              </div>
              <span className="status">Teacher</span>
            </div>
            {teamDashboard ? (
              <div className="dashboard">
                <div className="dashboard-grid">
                  <div className="card">
                    <h4>Members</h4>
                    <p>{teamDashboard.memberCount}</p>
                  </div>
                  <div className="card">
                    <h4>Total runs</h4>
                    <p>{teamDashboard.totalRuns}</p>
                  </div>
                  <div className="card">
                    <h4>Total tokens</h4>
                    <p>{teamDashboard.totalTokens}</p>
                  </div>
                </div>
                <div className="card">
                  <h4>Runs by assignment</h4>
                  <ul>
                    {(teamDashboard.assignmentStats || []).map((item) => (
                      <li key={item.assignmentId || item.title}>
                        {item.title} â€” {item.count}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h4>Recent team runs</h4>
                  <ul>
                    {(teamDashboard.recentRuns || []).map((run) => (
                      <li key={run._id}>
                        {run.language} â€” {run.framework} â€”{' '}
                        {new Date(run.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h4>Team activity</h4>
                  <ul>
                    {(teamActivity || []).map((item) => (
                      <li key={item._id}>
                        {item.action.replace(/_/g, ' ')} â€”{' '}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="hint">Loading team dashboardâ€¦</p>
            )}
          </div>
        </section>
      )}

      {activePage === 'admin' && user?.isAdmin && (
        <section className="account">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Teacher dashboard</h2>
                <p>Users, recent runs, and assignments.</p>
              </div>
              <span className="status">Admin</span>
            </div>
            {adminAudit ? (
              <div className="dashboard">
                <div className="card">
                  <h4>Users</h4>
                  <div className="table">
                    <div className="table-row table-head">
                      <span>Email</span>
                      <span>Created</span>
                    </div>
                    {adminAudit.users.map((item) => (
                      <div className="table-row" key={item._id}>
                        <span>{item.email}</span>
                        <span>
                          {new Date(item.createdAt || item._id).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h4>Recent runs</h4>
                  <ul>
                    {adminAudit.runs.map((run) => (
                      <li key={run._id}>
                        {run.language} — {run.framework} — {new Date(run.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h4>Recent assignments</h4>
                  <ul>
                    {(adminAudit.assignments || []).map((assignment) => (
                      <li key={assignment._id}>
                        {assignment.title}
                        {assignment.course ? ` — ${assignment.course}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h4>Recent work</h4>
                  <ul>
                    {(adminAudit.work || []).map((item) => (
                      <li key={item._id}>
                        {item.title} — {item.language || 'Unknown'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="hint">Loading audit data…</p>
            )}
          </div>
        </section>
      )}

      {activePage === 'users' && user?.isAdmin && (
        <section className="account">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>User directory</h2>
                <p>Search and filter registered users.</p>
              </div>
              <span className="status">Admin</span>
            </div>
            <div className="account-form">
              <label>
                Search by email or name
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search..."
                />
              </label>
            </div>
            <div className="table">
              <div className="table-row table-head">
                <span>Email</span>
                <span>Created</span>
              </div>
              {(adminUsers || [])
                .filter((item) => {
                  const term = userSearch.trim().toLowerCase()
                  if (!term) return true
                  return (
                    item.email?.toLowerCase().includes(term) ||
                    item.name?.toLowerCase().includes(term)
                  )
                })
                .map((item) => (
                  <div className="table-row" key={item._id}>
                    <span>{item.email}</span>
                    <span>
                      {new Date(item.createdAt || item._id).toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {activePage === 'profile' && (
        <section className="account">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Profile</h2>
                <p>Update your name and password.</p>
              </div>
              <span className="status">Account</span>
            </div>
            <form
              className="account-form"
              onSubmit={(event) => {
                event.preventDefault()
                handleProfileSave()
              }}
            >
              <label>
                Name
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label>
                Major
                <input
                  value={profileMajor}
                  onChange={(event) => setProfileMajor(event.target.value)}
                  placeholder="Computer Science"
                />
              </label>
              <label>
                Year
                <input
                  value={profileYear}
                  onChange={(event) => setProfileYear(event.target.value)}
                  placeholder="Sophomore"
                />
              </label>
              <label>
                University
                <input
                  value={profileUniversity}
                  onChange={(event) => setProfileUniversity(event.target.value)}
                  placeholder="Your university"
                />
              </label>
              <label>
                Bio
                <textarea
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                  placeholder="Short bio about your studies."
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(event) => setProfilePassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </label>
              <button className="primary" type="submit">
                Save profile
              </button>
              {profileStatus && <p className="hint">{profileStatus}</p>}
            </form>
          </div>
        </section>
      )}

      {activePage === 'billing' && (
        <section className="account">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Plans & billing</h2>
                <p>Student-first pricing with team support.</p>
              </div>
              <span className="status">Plans</span>
            </div>
            <div className="pricing-grid">
              <div className="panel">
                <h3>Free</h3>
                <p className="price">$0</p>
                <p>Basic generation, 50 runs/day.</p>
                <button className="ghost small">Current plan</button>
              </div>
              <div className="panel highlight">
                <h3>Pro Student</h3>
                <p className="price">$6</p>
                <p>Higher limits, priority queue, more exports.</p>
                <button className="primary">Upgrade (placeholder)</button>
              </div>
              <div className="panel">
                <h3>Team</h3>
                <p className="price">$15</p>
                <p>Shared workspaces, audit logs, team reports.</p>
                <button className="ghost small">Contact admin</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {showWorkspacePage && (
      <section className="workspace">
        <div className="panel input">
          <div className="panel-header">
            <div>
              <h2>Source input</h2>
              <p>Drop a module or paste assignment context.</p>
            </div>
            <span className="status">Ready</span>
          </div>
          <div className="presets">
            <span className="label">Presets</span>
            <div className="preset-buttons">
              {presets.map((item) => (
                <button
                  key={item.id}
                  className={`ghost small ${preset === item.id ? 'active' : ''}`}
                  onClick={() => applyPreset(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="upload">
            <label className="upload-button">
              Upload files or folder
              <input
                type="file"
                multiple
                webkitdirectory="true"
                onChange={handleFiles}
              />
            </label>
            <div className="upload-meta">
              <span>{files.length} file(s) selected</span>
              <span>Auto-detected: {language}</span>
            </div>
          </div>
          <div className="filter-grid">
            <label>
              Include (comma-separated)
              <input
                value={includePatterns}
                onChange={(event) => setIncludePatterns(event.target.value)}
                placeholder="src/**,lib/**"
              />
            </label>
            <label>
              Exclude (comma-separated)
              <input
                value={excludePatterns}
                onChange={(event) => setExcludePatterns(event.target.value)}
                placeholder="node_modules,dist"
              />
            </label>
          </div>
          <div className="file-tree">
            <div className="tree-header">
              File tree (
              {
                applyFilters(
                  files,
                  includePatterns,
                  excludePatterns,
                  fileOverrides,
                ).length
              }{' '}
              included)
            </div>
            <div className="tree-body">
              {buildTree(files).map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  includePatterns={includePatterns}
                  excludePatterns={excludePatterns}
                  fileOverrides={fileOverrides}
                  onToggle={toggleFileOverride}
                  onClearFolder={clearOverridesForFolder}
                />
              ))}
            </div>
          </div>
          <div className="assignment-banner">
            <div>
              <p className="label">Assignment context</p>
              <h4>
                {selectedAssignment?.title || 'No assignment linked'}
              </h4>
              <p className="hint">
                {selectedAssignment
                  ? `${selectedAssignment.course || 'Course not set'}${
                      selectedAssignment.dueDate
                        ? ` â€” due ${new Date(
                            selectedAssignment.dueDate,
                          ).toLocaleDateString()}`
                        : ''
                    }`
                  : 'Select an assignment to tailor tests and integrity rules.'}
              </p>
            </div>
            <div className="integrity-pill">
              {integrityMode ? 'Integrity mode on' : 'Integrity mode off'}
            </div>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck="false"
          />
          <div className="field-grid">
            <label>
              Language
              <input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              />
            </label>
            <label>
              Framework
              <input
                value={framework}
                onChange={(event) => setFramework(event.target.value)}
              />
            </label>
          </div>
          <div className="panel-footer">
            <div className="toggles">
              <label>
                <input
                  type="checkbox"
                  checked={includeIntegration}
                  onChange={(event) =>
                    setIncludeIntegration(event.target.checked)
                  }
                />
                Include integration tests
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeRegression}
                  onChange={(event) =>
                    setIncludeRegression(event.target.checked)
                  }
                />
                Add regression guards
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={integrityMode}
                  onChange={(event) => setIntegrityMode(event.target.checked)}
                />
                Plagiarism-safe mode
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={studyMode}
                  onChange={(event) => setStudyMode(event.target.checked)}
                />
                Study mode
              </label>
            </div>
            <button className="primary" onClick={handleGenerate}>
              {isGenerating ? 'Generating…' : 'Generate tests'}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Comments</h2>
              <p>Share notes with your team or self.</p>
            </div>
            <span className="status">Live</span>
          </div>
          <div className="account-form">
            <label>
              New comment
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Leave feedback for your team..."
              />
            </label>
            <button className="ghost" onClick={handleAddComment}>
              Post comment
            </button>
          </div>
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment._id}>
                <p>{comment.message}</p>
                <span className="hint">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!studyMode && <div className="panel output">
          <div className="panel-header">
            <div>
              <h2>Generated suite</h2>
              <p>Actionable, readable, and production-ready.</p>
            </div>
            <span className={`status ${hasResults ? 'live' : ''}`}>
              {hasResults ? 'Complete' : 'Waiting'}
            </span>
          </div>

          <div className="coverage">
            <div>
              <p className="label">Coverage projection</p>
              <h3>
                {coverage.before}% → {coverage.after}%{' '}
                <span>+{coverage.delta}%</span>
              </h3>
            </div>
            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${coverage.after}%` }}
              ></div>
            </div>
          </div>
          <div className="stream-status">
            <span>{isStreaming ? 'Streaming output…' : 'Idle'}</span>
            <span>Token estimate: {tokenEstimate}</span>
          </div>
          <div className="stream-bar">
            <div
              className="stream-bar-fill"
              style={{
                width: `${Math.min(
                  100,
                  (tokenEstimate / maxOutputTokens) * 100,
                )}%`,
              }}
            ></div>
            <div
              className="stream-bar-cursor"
              style={{
                left: `${Math.min(
                  100,
                  (tokenEstimate / maxOutputTokens) * 100,
                )}%`,
              }}
            ></div>
          </div>

          <div className="grid">
            <div className="card">
              <h4>Coverage analysis</h4>
              <ul>
                {(isStreaming && liveSections.coverage_analysis.length
                  ? liveSections.coverage_analysis
                  : result?.coverage_analysis || []
                ).map((item, index) => (
                  <li key={`${item.function}-${index}`}>
                    {item.function} — {item.risk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h4>Untested paths found</h4>
              <ul>
                {(isStreaming && liveSections.untested_paths.length
                  ? liveSections.untested_paths
                  : result?.untested_paths || []
                ).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

            <div className="card code-block">
              <div className="card-header">
                <h4>Generated tests</h4>
                <div className="button-row">
                  <button className="ghost small" onClick={handleCopy}>
                    Copy
                  </button>
                  <button className="ghost small" onClick={handleExport}>
                    Export
                  </button>
                  <button className="ghost small" onClick={handleSaveWork}>
                    Save to library
                  </button>
                </div>
              </div>
            <pre>
              <code>
                {isStreaming && streamText ? streamText : result?.generated_tests}
              </code>
            </pre>
            <p className="hint">
              {includeIntegration
                ? 'Integration hooks included.'
                : 'Integration tests disabled.'}{' '}
              {includeRegression ? 'Regression guards included.' : ''}{' '}
              {integrityMode ? 'Integrity mode enforced.' : 'Integrity mode off.'}
            </p>
            <div className="export-row">
              <input
                value={exportPath}
                onChange={(event) => setExportPath(event.target.value)}
                placeholder="Export path"
              />
              <span className="hint">Saved path updates after export.</span>
            </div>
            {workStatus && <p className="hint">{workStatus}</p>}
          </div>

          <div className="grid">
            <div className="card">
              <h4>Coverage improvement estimate</h4>
              <p>
                {isStreaming && liveSections.coverage_improvement
                  ? liveSections.coverage_improvement
                  : result?.coverage_improvement}
              </p>
            </div>
            <div className="card">
              <h4>Suggested follow-up</h4>
              <p>
                {isStreaming && liveSections.suggested_follow_up
                  ? liveSections.suggested_follow_up
                  : result?.suggested_follow_up}
              </p>
            </div>
          </div>

          <div className="card">
            <h4>Diff against existing tests</h4>
            <div className="diff-row">
              <input
                value={existingPath}
                onChange={(event) => setExistingPath(event.target.value)}
                placeholder="Path to existing test file (optional)"
              />
              <button className="ghost small" onClick={handleDiff}>
                Generate diff
              </button>
            </div>
            {diffText ? (
              <pre className="diff">
                <code>{diffText}</code>
              </pre>
            ) : (
              <p className="hint">
                Provide a test path to compare with generated output.
              </p>
            )}
          </div>

          <div className="card">
            <h4>Version history</h4>
            <div className="diff-row">
              <input
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="Version label (e.g., v1, before refactor)"
              />
              <button className="ghost small" onClick={handleSaveVersion}>
                Save version
              </button>
            </div>
            <ul>
              {versions.map((version) => (
                <li key={version._id}>
                  {version.label} â€”{' '}
                  {new Date(version.createdAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        </div>}
      </section>
      )}
    </main>
  </div>
  </div>
  )
}

export default App

const SETTINGS_KEY = 'itge.settings.v1'

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function useLocalStorageSync(state) {
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state))
  }, [state])
}

const presets = [
  {
    id: 'python-pytest',
    label: 'Python + PyTest',
    language: 'Python',
    framework: 'PyTest',
    template: starterInput,
  },
  {
    id: 'ts-jest-rtl',
    label: 'TS + Jest + RTL',
    language: 'TypeScript',
    framework: 'Jest + React Testing Library',
    template: `LANGUAGE: TypeScript
FRAMEWORK: Jest + React Testing Library
CODE:
\`\`\`tsx
export function Greeting({ name }: { name: string }) {
  if (!name) return <span>Anonymous</span>
  return <h1>Hello {name}</h1>
}
\`\`\`
EXISTING TESTS:
\`\`\`
NONE
\`\`\`
CONTEXT: Component used in onboarding.`,
  },
  {
    id: 'js-jest',
    label: 'JS + Jest',
    language: 'JavaScript',
    framework: 'Jest',
    template: `LANGUAGE: JavaScript
FRAMEWORK: Jest
CODE:
\`\`\`js
export const clamp = (value, min, max) => {
  if (value < min) return min
  if (value > max) return max
  return value
}
\`\`\`
EXISTING TESTS:
\`\`\`
NONE
\`\`\`
CONTEXT: Shared utility used in UI validation.`,
  },
]

const assignmentTemplates = [
  {
    id: 'dsa',
    label: 'DSA Project',
    title: 'Data Structures & Algorithms Lab',
    description:
      'Implement core data structures or algorithms and verify performance and edge cases.',
    rubric:
      'Correctness, time complexity, edge cases, input validation, test coverage',
  },
  {
    id: 'oop',
    label: 'OOP Project',
    title: 'Object-Oriented Design Assignment',
    description:
      'Build a modular, testable OOP solution with clear class responsibilities.',
    rubric:
      'Encapsulation, class design, SOLID principles, error handling, test coverage',
  },
  {
    id: 'db',
    label: 'Database Project',
    title: 'Database Systems Assignment',
    description:
      'Design schema and implement queries with accuracy and performance in mind.',
    rubric:
      'Schema design, query correctness, indexing strategy, edge cases, test coverage',
  },
]

const rubricPresets = [
  {
    id: 'balanced',
    label: 'Balanced',
    value:
      'Correctness, edge cases, input validation, performance expectations, test coverage',
  },
  {
    id: 'edge',
    label: 'Edge-case heavy',
    value:
      'Boundary conditions, invalid inputs, null handling, error messages, test coverage',
  },
  {
    id: 'performance',
    label: 'Performance',
    value: 'Complexity analysis, large inputs, runtime limits, test coverage',
  },
]

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

const detectLanguageFromFiles = (readFiles) => {
  const counts = {}
  readFiles.forEach((file) => {
    const ext = file.name.slice(file.name.lastIndexOf('.'))
    const language = extensionMap[ext]
    if (language) {
      counts[language] = (counts[language] || 0) + 1
    }
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || 'JavaScript'
}

const extensionMap = {
  '.py': 'Python',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rs': 'Rust',
  '.cpp': 'C++',
  '.c': 'C',
}

const parsePatterns = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const toRegex = (pattern) => {
  const normalized = /[*?]/.test(pattern) ? pattern : `*${pattern}*`
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${regex}$`, 'i')
}

const applyFilters = (allFiles, include, exclude, overrides = {}) => {
  const includePatterns = parsePatterns(include)
  const excludePatterns = parsePatterns(exclude)
  const includeRegexes = includePatterns.map(toRegex)
  const excludeRegexes = excludePatterns.map(toRegex)

  return allFiles.filter((file) => {
    const name = file.name || ''
    if (Object.prototype.hasOwnProperty.call(overrides, name)) {
      return overrides[name]
    }
    const included =
      includeRegexes.length === 0
        ? true
        : includeRegexes.some((regex) => regex.test(name))
    const excluded = excludeRegexes.some((regex) => regex.test(name))
    return included && !excluded
  })
}

const buildTree = (allFiles) => {
  const root = []
  const map = new Map()

  allFiles.forEach((file) => {
    const segments = (file.name || '').split('/')
    let current = root
    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      let node = map.get(currentPath)
      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          children: [],
          isFile: index === segments.length - 1,
          tokenEstimate: 0,
        }
        map.set(currentPath, node)
        current.push(node)
      }
      if (index === segments.length - 1) {
        node.tokenEstimate = estimateTokens(file.content || '')
      }
      current = node.children
    })
  })

  return root
}

const nodeHasIncluded = (
  node,
  includePatterns,
  excludePatterns,
  overrides,
) => {
  if (node.isFile) {
    return (
      applyFilters([{ name: node.path }], includePatterns, excludePatterns, overrides)
        .length > 0
    )
  }
  return node.children?.some((child) =>
    nodeHasIncluded(child, includePatterns, excludePatterns, overrides),
  )
}

const TreeNode = ({
  node,
  includePatterns,
  excludePatterns,
  fileOverrides,
  onToggle,
  onClearFolder,
}) => {
  const included = nodeHasIncluded(
    node,
    includePatterns,
    excludePatterns,
    fileOverrides,
  )
  return (
    <div className={`tree-node ${included ? '' : 'excluded'}`}>
      <div className="tree-label">
        <span>{node.isFile ? '•' : '▸'}</span>
        {node.isFile && (
          <input
            type="checkbox"
            checked={resolveOverride(
              node.path,
              includePatterns,
              excludePatterns,
              fileOverrides,
            )}
            onChange={(event) => onToggle(node.path, event.target.checked)}
          />
        )}
        <span>{node.name}</span>
        {node.isFile && (
          <span className="token-pill">~{node.tokenEstimate} tokens</span>
        )}
        {!node.isFile && node.children?.length > 0 && (
          <button
            className="ghost small"
            type="button"
            onClick={() => onClearFolder(node.path)}
          >
            Clear overrides
          </button>
        )}
      </div>
      {node.children?.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              includePatterns={includePatterns}
              excludePatterns={excludePatterns}
              fileOverrides={fileOverrides}
              onToggle={onToggle}
              onClearFolder={onClearFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const resolveOverride = (path, includePatterns, excludePatterns, overrides) => {
  if (Object.prototype.hasOwnProperty.call(overrides, path)) {
    return overrides[path]
  }
  return (
    applyFilters([{ name: path }], includePatterns, excludePatterns).length > 0
  )
}

const parseSectionsFromMarkdown = (text = '') => {
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

  return {
    coverage_analysis: toList(getSection('Coverage analysis')).map((line) => {
      const [fn, risk] = line.split('—').map((part) => part.trim())
      return { function: fn || line, risk: risk || 'MEDIUM' }
    }),
    untested_paths: toList(getSection('Untested paths found')),
    coverage_improvement: getSection('Coverage improvement estimate'),
    suggested_follow_up: getSection('Suggested follow-up'),
  }
}

const estimateTokens = (text) => Math.max(1, Math.ceil(text.length / 4))

const maxOutputTokens = 1800

const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const isValidPassword = (value = '') => value.length >= 8








