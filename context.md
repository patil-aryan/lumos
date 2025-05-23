Context for Cursor: Building "Lumos" - The AI-Powered Illumination Engine for Product Managers

1. Product Name: Lumos
2. Overall Product Vision & Core Problem Solved:
   Lumos is a sophisticated SaaS AI application designed to be the indispensable illumination engine for Product Managers (PMs). PMs are constantly navigating a dense fog of information scattered across numerous platforms like Slack, Jira, Confluence, and internal documents. This fragmentation leads to missed insights, duplicated efforts, delayed decisions, and a general feeling of being overwhelmed.
   Lumos solves this by:
   Connecting Securely: Integrating seamlessly and securely with the PM's existing toolset (Slack, Jira, Confluence) and allowing them to upload relevant documents.
   Centralizing Knowledge: Creating a unified, queryable knowledge base from this disparate data.
   Providing AI-Powered Synthesis: Leveraging advanced Language Models (LLMs) and Retrieval Augmented Generation (RAG) to provide concise, synthesized answers to PMs' complex questions.
   Ensuring Trust & Verifiability: Crucially, every piece of information Lumos provides is grounded in the PM's actual data, with clear, easily accessible citations and links back to the original source (similar to Perplexity AI's "Sources" feature).
   Streamlining PM Workflows: Ultimately, Lumos empowers PMs to surface critical insights, track project progress, understand customer feedback, identify risks, and make faster, more informed, data-driven decisions, illuminating the path forward.
3. Target User Persona:
   Primary: Product Managers in small to mid-sized technology companies (initially).
   Profile:
   Manages one or more products/features.
   Collaborates with cross-functional teams (Engineering, Design, Sales, Support, Marketing).
   Heavily reliant on Slack for real-time communication and updates.
   Uses Jira for tracking development tasks, bugs, and sprints.
   Uses Confluence for product specifications, documentation, meeting notes, and project plans.
   Often has local documents (research, reports, user interview notes) they need to reference.
   Struggles to keep up with the volume of information and connect dots across these platforms.
   Needs to quickly get up to speed on topics, recall past decisions, or summarize diverse viewpoints.
4. Core Frontend Architecture & Technology Stack:
   Framework: Next.js (using the App Router).
   Language: TypeScript.
   Styling: Tailwind CSS.
   Chat Functionality: Vercel AI SDK (leveraging useChat hook and streaming capabilities).
   State Management: Zustand or Jotai for global state (user auth, workspace, current project); React Context for more localized, less frequently changing global state. useState/useReducer for local component state.
   API Client: A dedicated service layer (e.g., using fetch or axios) to interact with the FastAPI backend.
5. Detailed Application Structure & User Flow:
   I. Onboarding & Workspace Setup:
   Signup:
   User signs up with email and password.
   Backend creates a User record and a default Workspace associated with that user (they become the owner).
   User is automatically logged in.
   Login: Standard email/password login.
   JWT Management: Secure handling of JWTs for session management (HttpOnly cookies preferred, managed by backend if possible, or secure frontend storage). Token sent with every authenticated API request.
   II. Main Application Layout:
   A persistent Sidebar on the left.
   A Main Content Area to the right of the sidebar, which renders the selected section.
   III. Sidebar Navigation Sections:
   Lumos Logo/Brand Element at the top.
6. Chat:
   Primary navigation link.
   Navigates to the chat interface for the currently active "Project" (see Hub). If no project is active, it might prompt to select or create one from the Hub.
7. Hub (/hub):
   Purpose: The central place for PMs to manage, organize, and revisit their "Projects." A "Project" in Lumos is a persistent, named conversation thread or a focused area of inquiry.
   UI:
   "New Project" Button:
   Prompts for a project name (can be optional, auto-generated if empty).
   Backend: POST /api/workspaces/{workspaceId}/projects (creates a new Project record).
   Frontend: Navigates to the Chat view (/chat/{newProjectId}) with this new, empty project context.
   List of Existing Projects:
   Fetched from GET /api/workspaces/{workspaceId}/projects.
   Each project item displays: Name, last activity date, perhaps a brief snippet of the latest interaction.
   Actions per project: Load (navigates to /chat/{projectId}), Rename, Delete.
   Search/filter functionality for projects (future enhancement).
8. Integrations (/integrations):
   Purpose: Manage connections to external data sources (Slack, Jira, Confluence).
   UI:
   Clear visual cards or list items for each supported integration.
   Each integration card shows:
   Icon (Slack, Jira, Confluence logos).
   Name of the service.
   Connection Status:
   "Not Connected": "Connect" button visible.
   "Connected as [Authenticated User/Account Name]": Shows who authorized the connection. "Manage" or "Disconnect" options.
   "Syncing Initial Data (X% complete)": Progress bar/indicator during the first backfill.
   "Last Synced: [Timestamp]" or "Up to Date."
   "Error: Re-authentication needed" or "Sync Failed": Clear error state with a "Reconnect" or "Troubleshoot" option.
   Connection Process: Clicking "Connect" initiates an OAuth 2.0 flow managed by the backend. The frontend redirects the user to the provider's auth page.
9. Settings (/settings):
   Purpose: Manage user and workspace preferences.
   UI Tabs/Sections:
   Profile: User's email, option to change password.
   Workspace: Rename current workspace. (Future: Invite members, manage roles).
   Usage/Billing: (Future feature) Display usage metrics, subscription details.
   User Account Dropdown/Icon (Bottom of Sidebar or Top Right): Logout, link to settings.
   IV. Chat View (/chat/{projectId} or /chat/new):
   This is the heart of Lumos.
   Layout:
   Project Title Area (Top): Displays the name of the current active "Project."
   Chat History Pane: A scrollable area displaying the sequence of user queries and AI (Lumos) responses for the current project.
   Chat Input Bar (Fixed Bottom):
   Main text input field for user queries (multi-line, auto-resizing).
   "Send" button (or Enter key press).
   File Upload Button: A clear icon (e.g., paperclip) to allow users to upload local files (.txt, .md, .pdf, .docx initially).
   File Upload Flow: User selects file(s). Frontend shows upload progress. Files are sent to a backend endpoint (POST /api/files/upload?workspace*id=X&project_id=Y). Once processed (parsed, chunked, embedded by backend), these files become part_of_the_context_for_the_current_project*. The UI might show a "File 'X' ready" message or a visual representation of the uploaded file in the chat history.
   (Optional) Source Filter Quick Select: Small icons or a dropdown to quickly toggle which connected sources (Slack, Jira, Confluence, Uploaded Files for this project) should be prioritized or included in the current query. This would be passed as a filter to the backend.
   Message Rendering:
   Distinct visual styling for user messages and Lumos (AI) messages.
   Lumos (AI) Messages:
   Streaming Text: Responses should stream token by token (using Vercel AI SDK).
   Citation Handling (Lumos's "Illumination" Feature - Critical):
   In-text Placeholders: If Lumos uses specific information from a source, the streamed text will contain subtle, unique placeholders (e.g., [Lumos_Ref_1], [Lumos_Ref_2]). These placeholders must be stable and parsable.
   "View Sources" Button/Icon: This button (e.g., a lightbulb icon, "Sources (N)") appears prominently with every Lumos message that contains citations. The "N" indicates the number of unique sources cited.
   Clicking "View Sources" opens a Right-Hand Side Panel ("Sources Panel").
   Sources Panel (Right-Hand Side):
   Context: This panel is dynamically populated based on the specific Lumos message for which "View Sources" was clicked.
   Content: A scrollable list of all unique sources referenced in that particular Lumos message.
   Each Source Item in the Panel:
   Source Type Icon: Clear icon for Slack, Jira, Confluence, or Uploaded File.
   Title/Identifier: A concise title (e.g., "Slack: #dev-channel message," "JIRA-123: New Feature Spec," "Confluence: Q3 Roadmap," "File: user_research_summary.pdf, Page 4").
   Rich Snippet: The actual, relevant text snippet from the source document/message that Lumos used. This provides immediate context.
   Direct Hyperlink: A clickable link that takes the user directly to the original Slack message, Jira issue, Confluence page, or (if feasible) a view of the uploaded document.
   Metadata: Author/Sender, Timestamp of the original item, Parent (e.g., Slack channel name, Jira project key).
   The panel should be easily dismissible.
   Interactions: Clicking a source item in the panel could highlight the corresponding placeholder in the main chat message or offer other actions.
   Loading & Error States:
   Clear loading indicators while Lumos is "thinking" / processing a query.
   Graceful display of errors from the backend (e.g., "Could not connect to Jira," "Query timed out," "One of your integrations needs re-authentication").
   V. Backend API Interactions (Key Endpoints Frontend will use):
   Auth: POST /auth/signup, POST /auth/login.
   Workspaces: GET /workspaces/me, PATCH /workspaces/{workspaceId}.
   Projects (Conversations): GET /workspaces/{workspaceId}/projects, POST /workspaces/{workspaceId}/projects, GET /projects/{projectId}/messages, PATCH /projects/{projectId}, DELETE /projects/{projectId}.
   Integrations: GET /integrations?workspace_id=X, GET /integrations/connect/{source_type} (initiates OAuth), DELETE /integrations/{integration_id}.
   Chat Query: POST /chat/query (or /projects/{projectId}/query)
   Request: {"query": string, "project_id": string, "workspace_id": string, "filters": object_optional, "file_contexts": array_of_uploaded_file_ids_optional}.
   Response (Streamed): Adhering to Vercel AI SDK format, but critically embedding structured citation data.
   Example:
   // Part of the streamed response for a message
   {
   "ui_type": "lumos_message_chunk", // Custom identifier for rich chunks
   "text_content": "The Q3 roadmap prioritizes feature X [Lumos_Ref_1]. Engineering estimates are in JIRA-789 [Lumos_Ref_2].",
   "citations_data": [
   { "placeholder_id": "Lumos_Ref_1", "source_type": "confluence", "title": "Q3 Product Roadmap", "snippet": "...", "url": "...", "author": "...", "timestamp": "..." },
   { "placeholder_id": "Lumos_Ref_2", "source_type": "jira", "title": "JIRA-789: Eng Estimates for X", "snippet": "...", "url": "...", "author": "...", "timestamp": "..." }
   ]
   }
   // Or, if Vercel AI SDK needs simpler stream, send citation metadata separately after text stream, or embed complex objects within its tool/data message types.
   Use code with caution.
   Json
   File Uploads: POST /files/upload?workspace_id=X&project_id=Y.
   VI. Key Technical Considerations for Frontend:
   State Management for Citations: The frontend needs to efficiently store and associate the detailed citation metadata with each AI message to populate the Sources Panel correctly when requested.
   Dynamic Placeholder Rendering: Logic to identify and potentially make the [Lumos_Ref_X] placeholders interactive in the chat message.
   Robust Error Handling: Especially around API calls, integration statuses, and streaming.
   Performance: Optimize rendering of long chat histories. Virtualization might be needed later. Streaming helps perceived performance significantly.
   Accessibility (A11y): Design with keyboard navigation, screen reader compatibility, and sufficient color contrast in mind.
   VII. What Lumos Should Feel Like (User Experience Goals):
   Intelligent & Insightful: Lumos should feel like a smart assistant that truly understands the PM's context.
   Trustworthy & Transparent: The citation mechanism is paramount. Users must trust that Lumos isn't hallucinating and can easily verify its claims.
   Efficient & Fast: Quick query responses, smooth streaming.
   Organized & Intuitive: Easy to manage projects, integrations, and navigate the app.
   Empowering: Lumos should make PMs feel more in control and capable of handling information.
   This detailed context should provide Cursor with a very deep understanding of Lumos, enabling it to generate highly relevant and accurate code suggestions, component structures, and logical flows for your frontend development. Remember to break down your specific development tasks for Cursor based on these larger sections.
