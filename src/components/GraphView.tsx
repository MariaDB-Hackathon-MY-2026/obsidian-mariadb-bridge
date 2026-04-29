import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'note' | 'tag';
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  distance: number;
  type: 'note-link' | 'tag-link';
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

export const GraphView: React.FC<{ onNodeClick: (name: string) => void }> = ({ onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/graph');
        const data: GraphData = await res.json();
        if (!data.nodes) return;
        renderGraph(data);
      } catch (err) {
        console.error("Failed to fetch graph data:", err);
      }
    };

    fetchData();

    const handleResize = () => {
        // Option to re-render on resize if needed
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderGraph = (data: GraphData) => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 600;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation<Node>(data.nodes)
      .force("link", d3.forceLink<Node, Link>(data.links).id(d => d.id).distance(d => d.type === 'tag-link' ? 60 : 150))
      .force("charge", d3.forceManyBody().strength(d => (d as any).type === 'tag' ? -150 : -300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => (d as any).type === 'tag' ? 25 : 45));

    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", (d: any) => d.type === 'tag-link' ? "rgba(34, 197, 94, 0.2)" : "rgba(124, 99, 255, 0.15)")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => d.type === 'tag-link' ? 1 : Math.max(1, 4 - (d.distance * 8)));

    const nodeColors = {
      note: "#7C63FF",
      tag: "#22c55e"
    };

    const node = g.append("g")
      .attr("cursor", "pointer")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("mouseenter", function(event, d) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("r", d.type === 'tag' ? 8 : 12)
          .attr("fill", d.type === 'tag' ? "#4ade80" : "#A78BFA");

        d3.select(this).select("text")
          .transition()
          .duration(200)
          .attr("opacity", 1)
          .attr("visibility", "visible")
          .attr("font-size", d.type === 'tag' ? "10px" : "12px");
      })
      .on("mouseleave", function(event, d) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("r", d.type === 'tag' ? 6 : 8)
          .attr("fill", d.type === 'tag' ? nodeColors.tag : nodeColors.note);

        d3.select(this).select("text")
          .transition()
          .duration(200)
          .attr("opacity", 0.7)
          .attr("visibility", d.type === 'tag' ? "visible" : "hidden")
          .attr("font-size", d.type === 'tag' ? "8px" : "10px");
      });

    node.append("circle")
      .attr("r", d => d.type === 'tag' ? 6 : 8)
      .attr("fill", d => d.type === 'tag' ? nodeColors.tag : nodeColors.note)
      .attr("stroke", "var(--header-val)")
      .attr("stroke-width", 2)
      .on("click", (event, d) => onNodeClick(d.name));

    node.append("text")
      .attr("x", d => d.type === 'tag' ? 10 : 12)
      .attr("y", 4)
      .text(d => d.name.replace('.md', ''))
      .attr("font-size", d => d.type === 'tag' ? "8px" : "10px")
      .attr("fill", "currentColor")
      .attr("opacity", 0.7)
      .attr("visibility", d => d.type === 'tag' ? "visible" : "hidden")
      .attr("font-family", "Inter, sans-serif")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    
    // Clone the SVG to avoid modifying the live one
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    // Add styles for the export
    const style = document.createElement('style');
    style.textContent = `
      text { font-family: Inter, sans-serif; }
      circle { transition: none; }
    `;
    svgClone.prepend(style);
    
    // Set explicit namespace
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `neural-graph-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={containerRef} className="w-full h-[700px] relative bg-sleek-card rounded-[32px] overflow-hidden border border-sleek-border group">
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h3 className="text-sm font-bold uppercase tracking-widest text-sleek-muted">Neural Knowledge Graph</h3>
        <p className="text-[10px] text-sleek-muted mt-1 flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sleek-accent"></span> Notes</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Tags</span>
          <span className="text-sleek-muted/60 ml-2">Edges: Explicit Tags & Semantic Similarity</span>
        </p>
      </div>

      <button 
        onClick={handleExportSVG}
        className="absolute top-8 right-8 z-20 p-3 bg-sleek-card hover:opacity-80 border border-sleek-border rounded-2xl text-sleek-muted hover:text-sleek-text transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 text-xs font-medium"
        title="Export as SVG"
      >
        <Download size={16} />
        Export SVG
      </button>

      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};
