import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  chart: string;
  id: string;
  className?: string;
  highlightedId?: string | null;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart, id, className, highlightedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Basic initialization
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#c2410c', // Matches branding
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#ea580c',
        lineColor: '#94a3b8',
        secondaryColor: '#334155',
        tertiaryColor: '#1e293b',
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '16px',
      },
      flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 50,
        htmlLabels: true,
        useMaxWidth: true,
      },
      securityLevel: 'loose',
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !chart) return;

    const renderChart = async () => {
      try {
        // Clear previous content
        containerRef.current!.innerHTML = '';
        
        // Inject highlighting if requested
        let finalChart = chart;
        if (highlightedId) {
          // Check if the node ID exists in the chart (case-insensitive check)
          const nodeRegex = new RegExp(`\\b${highlightedId}\\b`, 'i');
          if (nodeRegex.test(chart)) {
            finalChart = `${chart}\n  classDef focusNode fill:#f97316,stroke:#ea580c,stroke-width:4px,color:#fff,font-weight:bold;\n  class ${highlightedId} focusNode;`;
          }
        }

        // Generate a unique ID for this specific render to avoid collisions
        const uniqueId = `mermaid-${id}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Render the diagram
        const { svg, bindFunctions } = await mermaid.render(uniqueId, finalChart);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          if (bindFunctions) {
            bindFunctions(containerRef.current);
          }
        }
      } catch (err) {
        console.error('Mermaid render failed:', err);
        if (containerRef.current) {
          containerRef.current.innerHTML = '<div class="text-muted-foreground text-xs p-4 border border-dashed rounded italic">Diagram structure unavailable</div>';
        }
      }
    };

    renderChart();
  }, [chart, id, highlightedId]); // re-render when highlightedId changes

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    />
  );
};

export default MermaidRenderer;
