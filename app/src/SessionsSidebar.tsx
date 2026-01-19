import { useState } from 'react';

const BATCH_SIZE = 10;

// Mock session data - in production this would come from the IPC API
const allSessions = [
  { id: 1, date: 'Jan 19, 2026', preview: 'Building a React dashboard component...' },
  { id: 2, date: 'Jan 18, 2026', preview: 'Debugging authentication flow issues' },
  { id: 3, date: 'Jan 17, 2026', preview: 'Setting up CI/CD pipeline with GitHub' },
  { id: 4, date: 'Jan 16, 2026', preview: 'Implementing user authentication with OAuth' },
  { id: 5, date: 'Jan 15, 2026', preview: 'Creating database migrations for new schema' },
  { id: 6, date: 'Jan 14, 2026', preview: 'Refactoring API endpoints for better performance' },
  { id: 7, date: 'Jan 13, 2026', preview: 'Adding unit tests for core utilities' },
  { id: 8, date: 'Jan 12, 2026', preview: 'Fixing CSS layout issues on mobile devices' },
  { id: 9, date: 'Jan 11, 2026', preview: 'Implementing real-time notifications' },
  { id: 10, date: 'Jan 10, 2026', preview: 'Setting up Docker containers for development' },
  { id: 11, date: 'Jan 9, 2026', preview: 'Creating documentation for API endpoints' },
  { id: 12, date: 'Jan 8, 2026', preview: 'Optimizing database queries for search' },
  { id: 13, date: 'Jan 7, 2026', preview: 'Adding error handling and logging' },
  { id: 14, date: 'Jan 6, 2026', preview: 'Implementing file upload functionality' },
  { id: 15, date: 'Jan 5, 2026', preview: 'Building dashboard analytics widgets' },
  { id: 16, date: 'Jan 4, 2026', preview: 'Configuring webpack for production builds' },
  { id: 17, date: 'Jan 3, 2026', preview: 'Adding internationalization support' },
  { id: 18, date: 'Jan 2, 2026', preview: 'Implementing dark mode theme toggle' },
  { id: 19, date: 'Jan 1, 2026', preview: 'Setting up project structure and tooling' },
  { id: 20, date: 'Dec 31, 2025', preview: 'Initial project planning and requirements' },
  { id: 21, date: 'Dec 30, 2025', preview: 'Researching tech stack options' },
  { id: 22, date: 'Dec 29, 2025', preview: 'Creating wireframes and mockups' },
];

export function SessionsSidebar() {
  const [selectedId, setSelectedId] = useState<number>(1);
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);

  const visibleSessions = allSessions.slice(0, visibleCount);
  const hasMoreSessions = visibleCount < allSessions.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allSessions.length));
  };

  return (
    <aside
      style={{
        width: '280px',
        height: '100vh',
        backgroundColor: '#1e1e2e',
        padding: '16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <h2
        style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: 600,
          color: '#cdd6f4',
        }}
      >
        Sessions
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleSessions.map((session) => {
          const isSelected = session.id === selectedId;
          return (
            <div
              key={session.id}
              onClick={() => setSelectedId(session.id)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: isSelected ? '#45475a' : '#313244',
                cursor: 'pointer',
                border: isSelected ? '1px solid #89b4fa' : '1px solid transparent',
              }}
            >
              <div style={{ fontSize: '12px', color: '#a6adc8', marginBottom: '4px' }}>
                {session.date}
              </div>
              <div style={{ fontSize: '14px', color: '#cdd6f4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.preview}
              </div>
            </div>
          );
        })}

        {hasMoreSessions && (
          <button
            onClick={handleLoadMore}
            style={{
              marginTop: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: '#313244',
              color: '#cdd6f4',
              border: '1px solid #45475a',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#45475a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#313244';
            }}
          >
            Load More
          </button>
        )}
      </div>
    </aside>
  );
}
