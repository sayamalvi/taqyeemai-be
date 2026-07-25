export const ResumeTemplateV1 = `
% Compile with: xelatex Resume.tex
% Requires Inter font installed (https://rsms.me/inter/)
\\documentclass[9pt,a4paper]{article}

\\usepackage[
  top=9mm,
  bottom=7mm,
  left=12mm,
  right=12mm
]{geometry}

\\usepackage{fontspec}
\\usepackage{fontawesome5}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{microtype}

\\definecolor{ResGray}{HTML}{1E1E1E}
\\definecolor{ResBlack}{HTML}{000000}

\\hypersetup{
  colorlinks=true,
  linkcolor=ResGray,
  urlcolor=ResGray,
  pdfborder={0 0 0}
}

\\setmainfont{Inter}[
  UprightFont = *-Regular,
  BoldFont = *-Bold,
  ItalicFont = *-Italic,
  BoldItalicFont = *-BoldItalic,
  FontFace = {sb}{n}{*-SemiBold},
  Scale = 0.95
]

\\newfontfamily\\InterSemiBold{Inter-SemiBold}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\raggedbottom

\\newcommand{\\bodytext}{\\fontsize{9.5}{11.8}\\selectfont\\color{ResBlack}}
\\newcommand{\\bodytextgray}{\\fontsize{9.5}{11.8}\\selectfont\\color{ResGray}}
\\newcommand{\\jobtitle}{\\fontsize{10.5}{12.5}\\selectfont\\InterSemiBold\\color{ResGray}}
\\newcommand{\\jobdate}{\\fontsize{9.5}{11.5}\\selectfont\\InterSemiBold\\color{ResGray}}
\\newcommand{\\projecttitle}{\\fontsize{10.5}{12.5}\\selectfont\\bfseries\\color{ResGray}}
\\newcommand{\\projecttitlesb}{\\fontsize{10.5}{12.5}\\selectfont\\InterSemiBold\\color{ResGray}}
\\newcommand{\\educationtext}{\\fontsize{10.5}{12.5}\\selectfont\\InterSemiBold\\color{ResGray}}
\\newcommand{\\educationdate}{\\fontsize{9.5}{11.5}\\selectfont\\InterSemiBold\\color{ResGray}}

\\newcommand{\\sqbullet}{\\raisebox{0.2ex}{\\color{ResGray}\\rule{2.4pt}{2.4pt}}}

\\newcommand{\\resumesection}[1]{%
  \\vspace{5pt}%
  \\noindent{\\fontsize{12}{12}\\selectfont\\bfseries\\color{ResBlack}#1}%
  \\par\\vspace{-5pt}%
  \\noindent\\textcolor{ResBlack!35}{\\rule{\\linewidth}{0.4pt}}%
  \\par\\vspace{3pt}%
}

\\setlist[itemize]{
  leftmargin=1.25em,
  labelsep=0.5em,
  itemsep=0pt,
  topsep=1pt,
  parsep=0pt,
  partopsep=0pt,
  label=\\sqbullet
}

\\begin{document}

% INSTRUCTIONS TO LLM:
% Populate the following sections using the parsed and optimized resume data.
% Escape special LaTeX characters properly (e.g. \\%, \\&, \\$, \\_).
% Ensure you follow the structure strictly.

% ---------- Header ----------
\\begin{center}
  {\\fontsize{22}{26}\\selectfont\\bfseries\\color{ResBlack} {{FULL_NAME}} \\par}
  {\\fontsize{16}{20}\\selectfont\\InterSemiBold\\color{ResGray} {{TARGET_ROLE}} \\par}
  \\vspace{4pt}
  {\\fontsize{9.5}{11.5}\\selectfont\\color{ResGray}%
    {{CONTACT_INFO_STRING}}
  }
\\end{center}
\\vspace{1pt}
\\vspace{2pt}

% ---------- Technical Skills ----------
\\resumesection{TECHNICAL SKILLS}

\\begin{itemize}
  {{SKILLS_LIST_ITEMS}}
\\end{itemize}

% ---------- Summary ----------
\\resumesection{SUMMARY}

\\vspace{1pt}
{\\bodytext
{{SUMMARY_TEXT}}
}

% ---------- Work Experience ----------
\\resumesection{WORK EXPERIENCE}

{{WORK_EXPERIENCE_ITEMS}}

% ---------- Projects ----------
\\resumesection{PROJECTS}

{{PROJECTS_ITEMS}}

% ---------- Education ----------
\\resumesection{EDUCATION}

{{EDUCATION_ITEMS}}

\end{document}
`;