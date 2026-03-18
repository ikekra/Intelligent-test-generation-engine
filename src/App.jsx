import { useEffect, useMemo, useState } from 'react'
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
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
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

  useLocalStorageSync({
    input,
    includeIntegration,
    includeRegression,
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
  })

  useEffect(() => {
    loadMe()
  }, [])

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
          options: {
            includeIntegration,
            includeRegression,
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
      if (data.isAdmin) loadAdminAudit()
      if (selectedTeamId) loadMembers(selectedTeamId)
    } catch (err) {
      setUser(null)
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
    } catch (err) {
      setDashboard(null)
    }
  }

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/teams', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      setTeams(data.teams || [])
    } catch (err) {
      setTeams([])
    }
  }

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      setWorkspaces(data.workspaces || [])
    } catch (err) {
      setWorkspaces([])
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      setAdminAudit(null)
    }
  }

  const handleAuth = async () => {
    setError('')
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload =
        authMode === 'login'
          ? { email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword, name: authName }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Auth failed.')
      setUser(data)
      setAuthPassword('')
      loadDashboard()
      loadTeams()
      loadWorkspaces()
      loadInvites()
      if (data.isAdmin) loadAdminAudit()
    } catch (err) {
      setError(err.message || 'Auth failed.')
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
      }),
    })
    if (response.ok) {
      setNewWorkspaceName('')
      setNewWorkspaceDesc('')
      loadWorkspaces()
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
          language,
          framework,
          includePatterns,
          excludePatterns,
          preset,
          fileOverrides,
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
    if (state.language) setLanguage(state.language)
    if (state.framework) setFramework(state.framework)
    if (state.includePatterns !== undefined)
      setIncludePatterns(state.includePatterns)
    if (state.excludePatterns !== undefined)
      setExcludePatterns(state.excludePatterns)
    if (state.preset) setPreset(state.preset)
    if (state.fileOverrides) setFileOverrides(state.fileOverrides)
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

  const authPanel = (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{user ? 'Account' : 'Sign in'}</h2>
          <p>{user ? 'Manage your workspace' : 'Access your live dashboard'}</p>
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
        <div className="account-form">
          <div className="button-row">
            <button
              className={`ghost small ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
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
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              placeholder="you@company.com"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              placeholder="Minimum 8 characters"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />
          </label>
          <button className="primary" onClick={handleAuth}>
            {authMode === 'login' ? 'Login' : 'Create account'}
          </button>
        </div>
      )}
    </div>
  )

  if (!user) {
    return (
      <div className="app landing">
        <nav className="top-nav">
          <div className="brand">
            <span className="logo-dot"></span>
            Intelligent Test Generation Engine
          </div>
          <div className="nav-actions">
            <button className="ghost small" onClick={() => setAuthMode('login')}>
              Login
            </button>
            <button className="primary" onClick={() => setAuthMode('register')}>
              Start free
            </button>
          </div>
        </nav>

        <header className="hero landing-hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">AI Quality Platform</div>
            <h1>Enterprise-grade test generation for modern teams.</h1>
            <p className="hero-subtitle">
              Paste code, detect coverage gaps, and generate production-ready
              tests with risk analysis in seconds.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setAuthMode('register')}>
                Create account
              </button>
              <button className="ghost">View demo output</button>
            </div>
            <div className="hero-stats">
              <div>
                <span className="stat-value">+36%</span>
                <span className="stat-label">Branch coverage lift</span>
              </div>
              <div>
                <span className="stat-value">12</span>
                <span className="stat-label">Risk paths flagged</span>
              </div>
              <div>
                <span className="stat-value">48s</span>
                <span className="stat-label">Average time to suite</span>
              </div>
            </div>
          </div>
          <div className="hero-card">{authPanel}</div>
        </header>

        <section className="features">
          <div className="feature-card">
            <h3>Coverage intelligence</h3>
            <p>Automated branch mapping with prioritized gaps.</p>
          </div>
          <div className="feature-card">
            <h3>Team workflows</h3>
            <p>Shared workspaces, invites, and audit-ready history.</p>
          </div>
          <div className="feature-card">
            <h3>Enterprise controls</h3>
            <p>Usage limits, admin dashboards, and policy enforcement.</p>
          </div>
        </section>

        <section className="pricing">
          <div>
            <h2>Simple pricing</h2>
            <p>Start free, scale as your team ships.</p>
          </div>
          <div className="pricing-grid">
            <div className="panel">
              <h3>Starter</h3>
              <p className="price">$0</p>
              <p>Personal workspace and local runs.</p>
            </div>
            <div className="panel highlight">
              <h3>Team</h3>
              <p className="price">$49</p>
              <p>Team workspaces, shared runs, and admin audit.</p>
            </div>
            <div className="panel">
              <h3>Enterprise</h3>
              <p className="price">Custom</p>
              <p>Dedicated models, SSO, and advanced governance.</p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="app app-shell">
      <nav className="top-nav">
        <div className="brand">
          <span className="logo-dot"></span>
          Intelligent Test Generation Engine
        </div>
        <div className="nav-actions">
          <button className="ghost small" onClick={handleResetUi}>
            Reset UI
          </button>
          <button className="ghost small" onClick={handleLogout}>
            Log out
          </button>
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
            <h4>Usage</h4>
            <p>{tokenEstimate} tokens (latest)</p>
          </div>
        </aside>

        <main className="shell-main">
          <header className="hero">
            <div className="hero-eyebrow">Workspace</div>
            <h1>Generate tests with audit-ready traceability.</h1>
            <p className="hero-subtitle">
              Build, review, and export a full suite with coverage guidance and
              team governance in one workspace.
            </p>
          </header>

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
                  <div className="dashboard-grid">
                    <div className="card">
                      <h4>Total runs</h4>
                      <p>{dashboard.totalRuns}</p>
                    </div>
                    <div className="card">
                      <h4>Avg tokens</h4>
                      <p>{dashboard.avgTokens}</p>
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
                </div>
              ) : (
                <p className="hint">Loading dashboard…</p>
              )}
            </div>
          </section>

      <section className="account">
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
                    setSelectedTeamId(event.target.value)
                    loadMembers(event.target.value)
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
                    placeholder="email@company.com"
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
                          <option value="member">Member</option>
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
            </div>
          ) : (
            <p className="hint">Sign in to manage teams.</p>
          )}
        </div>

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
      </section>

      {user?.isAdmin && (
        <section className="account">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Admin audit</h2>
                <p>Users and recent runs.</p>
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
              </div>
            ) : (
              <p className="hint">Loading audit data…</p>
            )}
          </div>
        </section>
      )}

      <section className="workspace">
        <div className="panel input">
          <div className="panel-header">
            <div>
              <h2>Source input</h2>
              <p>Drop a module or paste context-rich instructions.</p>
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
            </div>
            <button className="primary" onClick={handleGenerate}>
              {isGenerating ? 'Generating…' : 'Generate tests'}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="panel output">
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
              {includeRegression ? 'Regression guards included.' : ''}
            </p>
            <div className="export-row">
              <input
                value={exportPath}
                onChange={(event) => setExportPath(event.target.value)}
                placeholder="Export path"
              />
              <span className="hint">Saved path updates after export.</span>
            </div>
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
        </div>
      </section>
    </div>
  )
}

export default App

const SETTINGS_KEY = 'itge.settings.v1'

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
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
  const normalized = /[\*\?]/.test(pattern) ? pattern : `*${pattern}*`
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
      .map((line) => line.replace(/^[\-*]\s*/, '').trim())
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
