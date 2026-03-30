import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/gemini.ts";

interface ExportOptions {
  format: 'json' | 'csv';
  userId?: string; // Optional: export for specific user
  dateFrom?: string;
  dateTo?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const options: ExportOptions = await req.json();
    const { format = 'json', userId, dateFrom, dateTo } = options;
    // Fetch all relevant data
    // 1. User profiles (anonymized)
    let profilesQuery = supabase
      .from('profiles')
      .select('id, academic_goals, current_streak, last_activity_date, created_at, updated_at');

    if (userId) profilesQuery = profilesQuery.eq('id', userId);
    const { data: profiles } = await profilesQuery;

    // 2. Exam logs
    let examLogsQuery = supabase
      .from('exam_logs')
      .select('*')
      .order('created_at', { ascending: true });

    if (userId) examLogsQuery = examLogsQuery.eq('user_id', userId);
    if (dateFrom) examLogsQuery = examLogsQuery.gte('created_at', dateFrom);
    if (dateTo) examLogsQuery = examLogsQuery.lte('created_at', dateTo);
    const { data: examLogs } = await examLogsQuery;

    // 3. Exam sessions
    let sessionsQuery = supabase
      .from('exam_sessions')
      .select('*')
      .order('created_at', { ascending: true });

    if (userId) sessionsQuery = sessionsQuery.eq('user_id', userId);
    if (dateFrom) sessionsQuery = sessionsQuery.gte('created_at', dateFrom);
    if (dateTo) sessionsQuery = sessionsQuery.lte('created_at', dateTo);
    const { data: examSessions } = await sessionsQuery;

    // 4. Mastery progression
    let masteryQuery = supabase
      .from('user_mastery_ledger')
      .select('*')
      .order('created_at', { ascending: true });

    if (userId) masteryQuery = masteryQuery.eq('user_id', userId);
    const { data: masteryData } = await masteryQuery;

    // 5. Knowledge graph entries (for content analysis)
    const { data: knowledgeGraph } = await supabase
      .from('knowledge_graph')
      .select('id, subject, topic, subtopic, source_year, created_at');

    // Compile research data
    const researchData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        filters: { userId, dateFrom, dateTo },
        totalUsers: profiles?.length || 0,
        totalExamLogs: examLogs?.length || 0,
        totalSessions: examSessions?.length || 0,
        totalMasteryRecords: masteryData?.length || 0,
      },
      // SECURITY: Use cryptographically random IDs instead of truncated UUIDs to prevent re-identification
      // Also aggregate timestamps to date-only for additional privacy
      userProfiles: (profiles || []).map((p, index) => ({
        anonymizedId: `user_${crypto.randomUUID().substring(0, 12)}`,
        targetScore: (p.academic_goals as any)?.target_utme_score || null,
        currentStreak: p.current_streak,
        lastActivityDate: p.last_activity_date ? p.last_activity_date.split('T')[0] : null, // Date only
        accountCreatedDate: p.created_at ? p.created_at.split('T')[0] : null, // Date only
      })),
      examLogs: (examLogs || []).map(log => ({
        anonymizedUserId: `user_${crypto.randomUUID().substring(0, 12)}`,
        anonymizedSessionId: `session_${crypto.randomUUID().substring(0, 12)}`,
        subject: log.subject,
        questionIndex: log.question_index,
        isCorrect: log.is_correct,
        timeSpentSeconds: log.time_spent_seconds,
        confidenceLevel: log.confidence_level,
        hintsUsed: log.hints_used,
        createdAtDate: log.created_at ? log.created_at.split('T')[0] : null, // Date only
      })),
      examSessions: (examSessions || []).map(session => ({
        anonymizedUserId: `user_${crypto.randomUUID().substring(0, 12)}`,
        anonymizedSessionId: `session_${crypto.randomUUID().substring(0, 12)}`,
        subjects: session.subjects,
        totalQuestions: session.total_questions,
        timeLimitMinutes: session.time_limit_minutes,
        status: session.status,
        score: session.score,
        startedAtDate: session.started_at ? session.started_at.split('T')[0] : null, // Date only
        completedAtDate: session.completed_at ? session.completed_at.split('T')[0] : null, // Date only
        // Remove diagnostic_data as it may contain identifiable patterns
      })),
      masteryProgression: (masteryData || []).map(m => ({
        anonymizedUserId: `user_${crypto.randomUUID().substring(0, 12)}`,
        subject: m.subject,
        topic: m.topic,
        subtopic: m.subtopic,
        masteryScore: m.mastery_score,
        attemptsCount: m.attempts_count,
        // Remove error_patterns as they may be too detailed for anonymization
        lastPracticedDate: m.last_practiced_at ? m.last_practiced_at.split('T')[0] : null, // Date only
        createdAtDate: m.created_at ? m.created_at.split('T')[0] : null, // Date only
      })),
      knowledgeGraphSummary: {
        totalEntries: knowledgeGraph?.length || 0,
        bySubject: (knowledgeGraph || []).reduce((acc: Record<string, number>, k) => {
          acc[k.subject] = (acc[k.subject] || 0) + 1;
          return acc;
        }, {}),
      },
      aggregateStatistics: calculateAggregateStats(examSessions || [], masteryData || [], examLogs || []),
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(researchData);
      return new Response(csvData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="research_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON
    return new Response(JSON.stringify(researchData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="research_export_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error) {
    console.error('Research export error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Export failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateAggregateStats(sessions: any[], mastery: any[], logs: any[]) {
  const completedSessions = sessions.filter(s => s.status === 'completed');

  // Score distribution
  const scores = completedSessions.map(s => s.score).filter(s => s !== null);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Mastery by subject
  const masteryBySubject: Record<string, { total: number; count: number }> = {};
  mastery.forEach(m => {
    if (!masteryBySubject[m.subject]) {
      masteryBySubject[m.subject] = { total: 0, count: 0 };
    }
    masteryBySubject[m.subject].total += m.mastery_score || 0;
    masteryBySubject[m.subject].count++;
  });

  // Question accuracy
  const correctLogs = logs.filter(l => l.is_correct === true).length;
  const totalLogs = logs.length;

  return {
    totalCompletedSessions: completedSessions.length,
    averageScore: Math.round(avgScore * 100) / 100,
    scoreDistribution: {
      below50: scores.filter(s => s < 50).length,
      '50to70': scores.filter(s => s >= 50 && s < 70).length,
      '70to90': scores.filter(s => s >= 70 && s < 90).length,
      above90: scores.filter(s => s >= 90).length,
    },
    masteryBySubject: Object.entries(masteryBySubject).reduce((acc, [subject, data]) => {
      acc[subject] = Math.round((data.total / data.count) * 100) / 100;
      return acc;
    }, {} as Record<string, number>),
    overallAccuracy: totalLogs > 0 ? Math.round((correctLogs / totalLogs) * 10000) / 100 : 0,
    totalQuestionsAnswered: totalLogs,
    uniqueUsers: new Set(sessions.map(s => s.user_id)).size,
  };
}

function convertToCSV(data: any): string {
  const lines: string[] = [];

  // Metadata
  lines.push('# Research Data Export');
  lines.push(`# Exported: ${data.exportMetadata.exportedAt}`);
  lines.push(`# Total Users: ${data.exportMetadata.totalUsers}`);
  lines.push(`# Total Sessions: ${data.exportMetadata.totalSessions}`);
  lines.push('');

  // Exam Sessions (with anonymized IDs)
  lines.push('## EXAM SESSIONS');
  lines.push('anonymized_user_id,anonymized_session_id,subjects,total_questions,time_limit_minutes,status,score,started_at_date,completed_at_date');
  data.examSessions.forEach((s: any) => {
    lines.push(`${s.anonymizedUserId},${s.anonymizedSessionId},"${(s.subjects || []).join(';')}",${s.totalQuestions},${s.timeLimitMinutes},${s.status},${s.score || ''},${s.startedAtDate || ''},${s.completedAtDate || ''}`);
  });
  lines.push('');

  // Mastery Progression (with anonymized IDs)
  lines.push('## MASTERY PROGRESSION');
  lines.push('anonymized_user_id,subject,topic,subtopic,mastery_score,attempts_count,last_practiced_date,created_at_date');
  data.masteryProgression.forEach((m: any) => {
    lines.push(`${m.anonymizedUserId},${m.subject},"${m.topic}","${m.subtopic || ''}",${m.masteryScore},${m.attemptsCount},${m.lastPracticedDate || ''},${m.createdAtDate || ''}`);
  });
  lines.push('');

  // Aggregate Statistics
  lines.push('## AGGREGATE STATISTICS');
  lines.push(`Total Completed Sessions,${data.aggregateStatistics.totalCompletedSessions}`);
  lines.push(`Average Score,${data.aggregateStatistics.averageScore}`);
  lines.push(`Overall Accuracy,${data.aggregateStatistics.overallAccuracy}%`);
  lines.push(`Total Questions Answered,${data.aggregateStatistics.totalQuestionsAnswered}`);
  lines.push(`Unique Users,${data.aggregateStatistics.uniqueUsers}`);

  return lines.join('\n');
}
