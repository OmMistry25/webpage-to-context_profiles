'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface TreeMapData {
  name: string
  value: number
  children?: TreeMapData[]
  url?: string
  type?: 'project' | 'crawl' | 'page'
}

interface TreeMapProps {
  data: TreeMapData[]
  width?: number
  height?: number
  onNodeClick?: (node: TreeMapData) => void
}

export default function TreeMap({ data, width = 800, height = 400, onNodeClick }: TreeMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const root = d3.hierarchy({ name: 'root', children: data })
      .sum(d => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemap = d3.treemap<TreeMapData>()
      .size([width, height])
      .padding(2)
      .round(true)

    treemap(root)

    const color = d3.scaleOrdinal()
      .domain(['project', 'crawl', 'page'])
      .range(['#3B82F6', '#10B981', '#F59E0B'])

    const g = svg.append('g')

    const cell = g.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)

    cell.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => color(d.data.type || 'project'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onNodeClick) {
          onNodeClick(d.data)
        }
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 0.8)
        
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .html(`
            <div><strong>${d.data.name}</strong></div>
            <div>Value: ${d.data.value}</div>
            ${d.data.type ? `<div>Type: ${d.data.type}</div>` : ''}
            ${d.data.url ? `<div>URL: ${d.data.url}</div>` : ''}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('opacity', 1)
        
        d3.selectAll('.tooltip').remove()
      })

    // Add text labels for larger rectangles
    cell.filter(d => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 20)
      .append('text')
      .attr('x', d => (d.x1 - d.x0) / 2)
      .attr('y', d => (d.y1 - d.y0) / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => {
        const name = d.data.name
        return name.length > 20 ? name.substring(0, 17) + '...' : name
      })

  }, [data, width, height, onNodeClick])

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded-lg"
      />
    </div>
  )
}
