The concept map backend is complete (knowledge_graph_nodes, edges tables, /concepts/map endpoint). The frontend needs a graph visualization library.

Frontend steps:
1. Install @xyflow/react (React Flow v12) and @dagrejs/dagre in apps/web

2. Build a ConceptMap component in components/concepts/:
   - Fetch from GET /api/v1/groups/{id}/concepts/map
   - Transform API response to React Flow format:
     * Nodes: { id, data: { label: concept_name, description }, position }
     * Edges: { id, source, target, label: relationship_type, animated: true }
   - Auto-layout using dagre: left→right hierarchical layout
   - Node colors by mastery: studied (green), partial (amber), not started (gray)

3. Interactive features:
   - Click node → side panel: concept description, related files, "Étudier ce concept" button (creates targeted flashcard set)
   - Hover node → highlight direct neighbors, dim others
   - Minimap in bottom-right
   - Zoom controls + "Ajuster la vue" button
   - In Arabic mode (RTL), flip dagre layout to right→left

4. Teacher controls:
   - Double-click empty space → add concept dialog
   - Click edge delete button → remove relationship
   - Add POST /groups/{id}/concepts and DELETE /groups/{id}/concepts/{id} backend endpoints if missing

5. Export as PNG using React Flow's toBlob() utility

Show complete React Flow setup, dagre auto-layout, the concept map component, node detail side panel, and teacher editing controls.
