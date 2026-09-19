import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  BorderStyle, 
  WidthType, 
  AlignmentType, 
  ShadingType 
} from 'docx';
import fs from 'fs';
import path from 'path';

// Primary Brand Colors
const COLOR_PRIMARY = "00DAF3";
const COLOR_SURFACE = "0B0E14";
const COLOR_SURFACE_CARD = "121822";
const COLOR_TEXT_PRIMARY = "1E293B";
const COLOR_TEXT_MUTED = "64748B";
const COLOR_BORDER = "CBD5E1";
const COLOR_HEADER_BG = "0F172A";

function createHeader(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 280, after: 140 },
  });
}

function createParagraph(text, isBold = false) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: isBold,
        size: 22,
        color: COLOR_TEXT_PRIMARY,
        font: "Calibri",
      }),
    ],
    spacing: { after: 120, line: 276 },
  });
}

function createBullet(text, boldPrefix = "") {
  const children = [];
  if (boldPrefix) {
    children.push(new TextRun({ text: boldPrefix, bold: true, size: 21, color: COLOR_TEXT_PRIMARY, font: "Calibri" }));
  }
  children.push(new TextRun({ text, size: 21, color: COLOR_TEXT_PRIMARY, font: "Calibri" }));

  return new Paragraph({
    children,
    bullet: { level: 0 },
    spacing: { after: 80, line: 260 },
  });
}

function createTableCell(text, isHeader = false, widthPercent = 25, isBold = false) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: {
      type: ShadingType.CLEAR,
      fill: isHeader ? COLOR_HEADER_BG : "F8FAFC",
    },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: isHeader || isBold,
            size: isHeader ? 20 : 19,
            color: isHeader ? "FFFFFF" : COLOR_TEXT_PRIMARY,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

async function generateDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // Document Title Block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 80 },
            children: [
              new TextRun({
                text: "PRINT TO FRAME ERP SYSTEM",
                bold: true,
                size: 32,
                color: "0093A8",
                font: "Calibri",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Frontend UI/UX Standardization & Universal Data Synchronization Comprehensive Audit Plan",
                bold: true,
                size: 26,
                color: "0F172A",
                font: "Calibri",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "Audit Specification, Inspection Matrix, Codebase Deep-Dive & Remediation Methodology",
                italics: true,
                size: 20,
                color: COLOR_TEXT_MUTED,
                font: "Calibri",
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("Document ID", true, 25),
                  createTableCell("PTF-AUDIT-PLAN-2026-09-09", false, 25),
                  createTableCell("System Target", true, 25),
                  createTableCell("Print To Frame ERP (React + Vite + Firebase)", false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Target Date", true, 25),
                  createTableCell("2026-09-09", false, 25),
                  createTableCell("Audit Scope", true, 25),
                  createTableCell("Frontend UI/UX & Universal Sync Architecture", false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Current Environment", true, 25),
                  createTableCell("Production / Staging Parity", false, 25),
                  createTableCell("Review Mode", true, 25),
                  createTableCell("Deep Source Code & Component Static Audit", false, 25),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // Executive Summary
          createHeader("1. Executive Summary & Objective", HeadingLevel.HEADING_1),
          createParagraph(
            "Print To Frame ERP is a centralized Single-Page Application (SPA) orchestrating the complete custom-framing lifecycle from lead generation and quoting through factory fabrication, logistics dispatch, invoicing, and agency partner management. Over rapid feature expansions, the application has accumulated diverse UI component variations and asynchronous data management patterns."
          ),
          createParagraph(
            "The objective of this System Review Plan is to perform a deep-dive static and architectural audit of the entire frontend codebase. The review focuses on two vital pillars: (1) UI/UX Standardization (enforcing design tokens, standard common primitives, responsive adaptations, and WCAG accessibility) and (2) Universal Synchronization (ensuring real-time Firestore listeners, optimistic UI updates, cross-module relational IDs, and user profile/messaging states operate seamlessly without data drift or visual flickers)."
          ),

          // Audit Scope & Modules
          createHeader("2. Codebase Surface & Audit Scope", HeadingLevel.HEADING_1),
          createParagraph("The review encompasses all 8 feature modules, context providers, core services, and common primitives:"),
          createBullet(" Leads (Leads.jsx, LeadCardDetails.jsx), Deals (Deals.jsx), Invoices (Invoices.jsx), Customers (Customers.jsx), Partners (Partners.jsx), Quotation Builder (QuotationBuilder.jsx), and Google Contact Sync.", "CRM & Sales Engine:"),
          createBullet(" Factory fabrication work orders (FabricationWorks.jsx, FabricationCardDetails.jsx), Logistics & Dispatch (Logistics.jsx, LogisticsCardDetails.jsx), and Frame Blueprint visualizer.", "Production & Logistics:"),
          createBullet(" Executive KPIs, domain filter cards, operational queues, and notification activity feed (Dashboard.jsx, NotificationsView.jsx).", "Executive Dashboard:"),
          createBullet(" Dynamic RBAC security permissions matrix (PermissionsManager.jsx), system telemetry & database export (AdminPanel.jsx), and staff/user approval database (AgentDatabase.jsx).", "Administration & Security:"),
          createBullet(" Algorithmic steel framing cost calculator (CostCalculator.jsx), full-screen chat workspace (Messages.jsx), and mini floating messenger (MiniChatDrawer.jsx).", "Tools & Real-time Messaging:"),
          createBullet(" Standard PageHeader, FilterBar, StatusBadge, SortableTable, UserAvatar, TwoToneIcon, ActivityTimeline, and the DetailModal compound component suite.", "Common Shared Primitives:"),
          createBullet(" Firebase configuration (firebase.js), real-time Firestore CRUD & subscriptions (firestoreSync.js), audit logging (auditLog.js), and messaging state (MessagingContext.jsx).", "State & Data Services:"),

          // Six Pillars of Inspection
          createHeader("3. Six Core Review Pillars", HeadingLevel.HEADING_1),
          createParagraph("The deep-code evaluation is structured across six systematic inspection vectors:"),

          createHeader("Pillar 1: Design Tokens, Theming & Visual Hierarchy", HeadingLevel.HEADING_2),
          createBullet(" Verify consistent usage of semantic CSS variables (--color-surface, --color-primary, --color-outline, --color-status-*) against hardcoded Tailwind palette classes (e.g. raw slate, blue, emerald).", "Token Adherence:"),
          createBullet(" Evaluate contrast compliance between dark mode and [data-theme='light'] modes, specifically ensuring status badge text switches to WCAG AA-compliant dark tints (-on variants).", "Light/Dark Parity:"),
          createBullet(" Enforce consistent typography pairing: Poppins/Inter (UI sans), Hanken Grotesk (display titles), and JetBrains Mono (financial sums, IDs, and timestamps).", "Typography Scale:"),
          createBullet(" Standardize card elevations (bg-surface-container/60), subtle cyan glows, border radii (rounded-2xl), and glassmorphism backdrops.", "Surface Elevation:"),

          createHeader("Pillar 2: UI Component Reuse & Common Primitive Adoption", HeadingLevel.HEADING_2),
          createBullet(" Identify views with raw <h1> or custom headers (e.g., CostCalculator.jsx, QuotationBuilder.jsx) and replace them with standard <PageHeader> and metric pills.", "PageHeader Consistency:"),
          createBullet(" Ensure all views with tab or search filtering use <FilterBar> with standard counts and pill highlights.", "FilterBar Adoption:"),
          createBullet(" Enforce <StatusBadge> with uniform pulse/dot indicators over ad-hoc status pills.", "StatusBadge Primitives:"),
          createBullet(" Validate all user representations against <UserAvatar>, utilizing role-based preset icons and image fallback handling.", "UserAvatar Standardization:"),
          createBullet(" Harmonize modal implementations with the <DetailModalLayout> compound component architecture, addressing 84KB monolithic files like LeadCardDetails.jsx.", "Modal Standardization:"),

          createHeader("Pillar 3: Universal Real-Time Data Sync Architecture", HeadingLevel.HEADING_2),
          createBullet(" Audit all subscribeToCollection and onSnapshot listeners in App.jsx and feature views for proper lifecycle teardown and single-source-of-truth subscriptions.", "Firestore Subscriptions:"),
          createBullet(" Verify that local optimistic state updates (setInvoices, setLeads, etc.) correctly merge with Firestore snapshot events without UI flickers or rollbacks.", "Optimistic Update Safety:"),
          createBullet(" Ensure multi-document operations (e.g., invoice settlement, lead conversion) use batchWrite or transactions to prevent partial writes.", "Batch & Transaction Integrity:"),
          createBullet(" Validate network disconnect behavior, offline caching, and error toast feedback via handleFirestoreError.", "Offline & Stale Data Resilience:"),

          createHeader("Pillar 4: Cross-Module Relational Data Synchronization", HeadingLevel.HEADING_2),
          createBullet(" Trace entity handoffs from Lead -> Deal -> Fabrication Project -> Logistics Delivery -> Invoice -> Customer -> Partner commission to ensure identity keys remain linked.", "Entity Traceability:"),
          createBullet(" Eliminate loose coupling (e.g., matching customers purely by string name/phone) in favor of immutable canonical IDs (NIC, customerId, leadId).", "Identifier Normalization:"),
          createBullet(" Ensure status advancements automatically propagate (e.g., Advance invoice payment triggering fabrication assembly authorization).", "Automated State Progression:"),

          createHeader("Pillar 5: User Session, Profile & Messaging Sync", HeadingLevel.HEADING_2),
          createBullet(" Verify that currentUser updates (name, role, avatar) instantly update header, sidebar, profile, and all active chat cards without page reloads.", "Session & Profile Sync:"),
          createBullet(" Verify real-time synchronization between MessagingContext unread badges, sidebar notification counters, and floating toast banners.", "Messaging Unread Synchronization:"),
          createBullet(" Ensure every state-mutating operation invokes logActivity() to maintain an unbroken audit trail in the auditLog collection.", "Audit Trail Consistency:"),

          createHeader("Pillar 6: Responsive UX & Accessibility (a11y)", HeadingLevel.HEADING_2),
          createBullet(" Validate touch target compliance (min 44x44px), safe area padding (pb-safe), and overlay sidebar closing on viewport resize.", "Mobile UX & Touch Targets:"),
          createBullet(" Inspect horizontal Kanban snap-scrolling on mobile devices (snap-x-mandatory).", "Kanban Mobile Responsiveness:"),
          createBullet(" Audit keyboard accessibility, focus visible rings (:focus-visible), and ARIA labels on icon-only action triggers.", "Accessibility Standards:"),

          // Execution Methodology & Milestones Table
          createHeader("4. Review Execution Phases & Deliverables", HeadingLevel.HEADING_1),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("Phase", true, 15),
                  createTableCell("Task Focus", true, 35),
                  createTableCell("Methodology & Inspection Action", true, 35),
                  createTableCell("Deliverable", true, 15),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Phase 1", false, 15, true),
                  createTableCell("Static Code & Component Inventory", false, 35),
                  createTableCell("Parse all 23 JSX files in src/components for ad-hoc styles, custom headers, and direct palette classes.", false, 35),
                  createTableCell("Component Matrix", false, 15),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Phase 2", false, 15, true),
                  createTableCell("Data Sync & Prop Flow Tracing", false, 35),
                  createTableCell("Map state propagation from App.jsx through CRM, Operations, Tools, and Context providers to detect desync points.", false, 35),
                  createTableCell("Sync Flow Map", false, 15),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Phase 3", false, 15, true),
                  createTableCell("Responsive & Theme Audit", false, 35),
                  createTableCell("Verify mobile viewports (360px - 768px), touch targets, and light/dark theme contrast compliance.", false, 35),
                  createTableCell("A11y/Theme Log", false, 15),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Phase 4", false, 15, true),
                  createTableCell("Findings Synthesis & Report Generation", false, 35),
                  createTableCell("Compile prioritized issues (P1-P4), code refactor proposals, and generate final Markdown + DOCX audit reports.", false, 35),
                  createTableCell("Audit Reports", false, 15),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // Verification & Quality Gates
          createHeader("5. Verification & Quality Gates", HeadingLevel.HEADING_1),
          createBullet(" Vitest test suite executing in ~2s covering permissions, email templates, and Firebase admin helpers.", "Unit Test Suite (npm test):"),
          createBullet(" Production build testing via Vite to ensure zero bundling warnings, syntax errors, or broken imports.", "Production Build (npm run build):"),
          createBullet(" Comprehensive ESLint static verification across all JS/JSX files to prevent lint regressions.", "Lint Check (npm run lint):"),
          createBullet(" Rules unit testing via Firebase local emulator to confirm client-side permissions match firestore.rules.", "Emulator Integration (npm run test:rules):"),

          // Next Steps
          createHeader("6. Next Steps & Approval", HeadingLevel.HEADING_1),
          createParagraph(
            "Upon user review and approval of this plan, the execution phase will immediately commence: inspecting every component file line-by-line, cataloging every UI/UX deviation and sync edge-case, and delivering the comprehensive findings in both the detailed Markdown document and the final executive DOCX report."
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve('Frontend_UIUX_Standardization_and_Universal_Sync_Audit_Plan_2026_09_09_07_25.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Document generated successfully at: ${outPath} (${buffer.length} bytes)`);
}

generateDocx().catch(err => {
  console.error("Failed to generate docx:", err);
  process.exit(1);
});
