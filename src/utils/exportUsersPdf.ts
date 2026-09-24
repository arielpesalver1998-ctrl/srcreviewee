import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { resolveCanonicalUserIdentity, formatFormalName, cleanOptionalName, deduplicateUsersByIdNumber, getUserAccountStatus, isValidUserRecord } from '../services/userIdentityResolver';
import { getUserRole } from './roleUtils';

export interface ExportUsersPdfOptions {
  statusFilter?: 'all' | 'active' | 'dropped' | 'pending'; // 'all' = include active + dropped, 'active' = active only, 'dropped' = dropped only, 'pending' = pending profile only
  roleFilter?: string; // 'all' | 'admin' | 'staff' | 'reviewee'
}

export interface ExportUsersPdfResult {
  success: boolean;
  count: number;
  filename: string;
  error?: string;
}

export async function downloadRegisteredUsersPdf(
  users: any[],
  options: ExportUsersPdfOptions = { statusFilter: 'all', roleFilter: 'all' }
): Promise<ExportUsersPdfResult> {
  try {
    if (!users || users.length === 0) {
      return {
        success: false,
        count: 0,
        filename: '',
        error: 'No user records available to generate PDF.',
      };
    }

    const uniqueUsers = deduplicateUsersByIdNumber(users);

    const filtered = uniqueUsers.filter((u) => {
      const accountStatus = getUserAccountStatus(u);
      if (accountStatus === 'merged' || accountStatus === 'deleted') {
        return false;
      }

      if (options.statusFilter === 'active') {
        if (accountStatus !== 'active' || !isValidUserRecord(u)) {
          return false;
        }
      } else if (options.statusFilter === 'dropped') {
        if (accountStatus !== 'dropped') {
          return false;
        }
      } else if (options.statusFilter === 'pending') {
        if (accountStatus !== 'pending_profile') {
          return false;
        }
      } else if (options.statusFilter === 'all') {
        // 'all' includes active and dropped users
        if (accountStatus !== 'active' && accountStatus !== 'dropped') {
          return false;
        }
        if (accountStatus === 'active' && !isValidUserRecord(u)) {
          return false;
        }
      }

      const role = getUserRole(u).toLowerCase();
      if (options.roleFilter && options.roleFilter !== 'all' && role !== options.roleFilter.toLowerCase()) {
        return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      return {
        success: false,
        count: 0,
        filename: '',
        error: 'No users match the selected status and role filters.',
      };
    }

    // Sort by Role (Admin -> Staff -> Reviewee) then alphabetically by Last Name
    filtered.sort((a, b) => {
      const roleRank: Record<string, number> = { Admin: 1, Staff: 2, Reviewee: 3 };
      const roleA = getUserRole(a);
      const roleB = getUserRole(b);
      const rankDiff = (roleRank[roleA] || 9) - (roleRank[roleB] || 9);
      if (rankDiff !== 0) return rankDiff;

      const canonA = resolveCanonicalUserIdentity(a);
      const canonB = resolveCanonicalUserIdentity(b);
      return canonA.lastName.localeCompare(canonB.lastName);
    });

    // Generate PDF in Landscape format for clean multi-column layout
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 60, 'F');

    // Teal Accent stripe
    doc.setFillColor(13, 148, 136); // teal-600
    doc.rect(0, 60, pageWidth, 4, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SAMARITAN REVIEW CENTER (SRC GRTMNDS)', 24, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text('OFFICIAL MASTER SYSTEM USERS DIRECTORY', 24, 44);

    // Meta details on top right
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240);
    doc.text(`Generated: ${dateFormatted} ${timeFormatted}`, pageWidth - 24, 26, { align: 'right' });
    
    let statusLabelText = 'ACTIVE ONLY';
    if (options.statusFilter === 'all') statusLabelText = 'ALL STATUS (INC. DROPPED)';
    else if (options.statusFilter === 'dropped') statusLabelText = 'DROPPED ONLY';
    else if (options.statusFilter === 'pending') statusLabelText = 'PENDING PROFILE ONLY';

    const filterLabel = `Filter: ${options.roleFilter ? options.roleFilter.toUpperCase() : 'ALL'} ROLES | ${statusLabelText} (${filtered.length} Users)`;
    doc.text(filterLabel, pageWidth - 24, 44, { align: 'right' });

    // Summary Statistics Pills
    const totalActive = filtered.filter(u => getUserAccountStatus(u) === 'active').length;
    const totalDropped = filtered.filter(u => getUserAccountStatus(u) === 'dropped').length;
    const totalPending = filtered.filter(u => getUserAccountStatus(u) === 'pending_profile').length;
    const totalReviewees = filtered.filter(u => getUserRole(u) === 'Reviewee').length;
    const totalStaff = filtered.filter(u => getUserRole(u) === 'Staff').length;
    const totalAdmins = filtered.filter(u => getUserRole(u) === 'Admin').length;

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let summaryText = `Summary: ${filtered.length} Total Users  |  ${totalActive} Active  |  ${totalDropped} Dropped`;
    if (totalPending > 0) summaryText += `  |  ${totalPending} Pending`;
    summaryText += `  |  ${totalReviewees} Reviewees  |  ${totalStaff} Staff  |  ${totalAdmins} Admins`;
    doc.text(summaryText, 24, 82);

    // Table Data preparation
    const tableRows = filtered.map((u, index) => {
      const canonical = resolveCanonicalUserIdentity(u);
      const role = getUserRole(u);
      const formalName = formatFormalName(canonical);
      const idNum = canonical.idNumber || u.seq_id || u.seqId || u.id_number || '—';
      const school = canonical.school || u.school_name || u.schoolName || u.school || '—';
      const branch = canonical.branch || u.review_branch || u.reviewBranch || u.branch || '—';
      const accStatus = getUserAccountStatus(u);
      let statusLabel = 'ACTIVE';
      if (accStatus === 'dropped') statusLabel = 'DROPPED';
      else if (accStatus === 'pending_profile') statusLabel = 'PENDING PROFILE';

      return [
        String(index + 1),
        idNum,
        formalName,
        role.toUpperCase(),
        statusLabel,
        canonical.email || '—',
        school,
        branch,
      ];
    });

    // Render AutoTable
    autoTable(doc, {
      startY: 92,
      head: [['#', 'ID Number', 'Full Name', 'Role', 'Status', 'Email Address', 'School / University', 'Branch']],
      body: tableRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 70, fontStyle: 'bold' },
        2: { cellWidth: 150, fontStyle: 'bold' },
        3: { cellWidth: 55, halign: 'center' },
        4: { cellWidth: 55, halign: 'center' },
        5: { cellWidth: 160 },
        6: { cellWidth: 160 },
        7: { cellWidth: 80 },
      },
      didParseCell: (data) => {
        // Highlight Dropped status in red/rose
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'DROPPED') {
            data.cell.styles.textColor = [190, 18, 60]; // rose-700
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 241, 242]; // rose-50
          } else {
            data.cell.styles.textColor = [13, 148, 136]; // teal-600
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 24, right: 24, bottom: 30 },
      didDrawPage: (data) => {
        // Footer on each page
        const str = `Page ${doc.getNumberOfPages()} • Samaritan Review Center Confidential Record`;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(str, pageWidth / 2, pageHeight - 14, { align: 'center' });
      },
    });

    const dateStr = now.toISOString().slice(0, 10);
    const statusTag = (options.statusFilter || 'all').toUpperCase();
    const filename = `SRC_Users_Directory_${statusTag}_${dateStr}.pdf`;

    doc.save(filename);

    return {
      success: true,
      count: filtered.length,
      filename,
    };
  } catch (err: any) {
    console.error('[downloadRegisteredUsersPdf] Error generating PDF:', err);
    return {
      success: false,
      count: 0,
      filename: '',
      error: err?.message || 'Failed to export PDF.',
    };
  }
}
