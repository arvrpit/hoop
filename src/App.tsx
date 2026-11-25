import { AppScreen } from './screens/AppScreen';
import { ErrorBoundary } from './ui/ErrorBoundary';

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function NoWebGL() {
  return (
    <main
      role="alert"
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        color: '#efe6da',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, lineHeight: 1.5 }}>
        <h1 style={{ fontWeight: 500, fontSize: 22, margin: '0 0 8px' }}>Hoop needs WebGL2</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Your browser or graphics settings don’t support WebGL2, which Hoop uses to draw fabric and thread.
          Try a current version of Chrome, Safari or Firefox, and check that hardware acceleration is turned
          on.
        </p>
      </div>
    </main>
  );
}

function Crashed({ error }: { error: Error }) {
  return (
    <main
      role="alert"
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        color: '#efe6da',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 460, lineHeight: 1.5 }}>
        <h1 style={{ fontWeight: 500, fontSize: 22, margin: '0 0 8px' }}>Hoop hit a problem</h1>
        <p style={{ margin: '0 0 12px', opacity: 0.8 }}>Reloading usually fixes it.</p>
        <p style={{ margin: '0 0 16px', opacity: 0.6, fontSize: 12, wordBreak: 'break-word' }}>
          {error.message.slice(0, 300)}
        </p>
        <button
          onClick={() => location.reload()}
          style={{
            font: 'inherit',
            padding: '8px 16px',
            borderRadius: 10,
            border: 0,
            background: '#efe6da',
            color: '#2a231f',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    </main>
  );
}

export default function App() {
  if (!hasWebGL2()) return <NoWebGL />;
  return (
    <ErrorBoundary fallback={(e) => <Crashed error={e} />}>
      <AppScreen />
    </ErrorBoundary>
  );
}
