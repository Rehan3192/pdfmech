import { guideForToolPath, relatedTools } from "../tool-discovery";

export function ToolDiscoveryStrip({ currentPath }: { readonly currentPath: string }) {
  const related = relatedTools(currentPath);
  const guide = guideForToolPath(currentPath);
  if (related.length === 0) return null;

  return (
    <aside className="tool-discovery" aria-labelledby="tool-discovery-title">
      <header>
        <div>
          <span>Keep working</span>
          <h2 id="tool-discovery-title">Useful tools for your next PDF task</h2>
          <p>Choose a focused workflow. Supported processing stays in your browser.</p>
        </div>
        <div className="tool-discovery-actions">
          {guide === null ? null : (
            <a className="tool-discovery-guide" href={guide.path}>Read guide: {guide.title}</a>
          )}
          <a className="tool-discovery-all" href="/tools">View all PDF tools <span aria-hidden="true">→</span></a>
        </div>
      </header>
      <div className="tool-discovery-grid">
        {related.map((tool) => (
          <a href={tool.path} key={tool.path} className="tool-discovery-card">
            <span className="tool-discovery-mark" aria-hidden="true">{tool.mark}</span>
            <span>
              <small>{tool.group}</small>
              <strong>{tool.name}</strong>
              <p>{tool.description}</p>
            </span>
            <b aria-hidden="true">→</b>
          </a>
        ))}
      </div>
    </aside>
  );
}
