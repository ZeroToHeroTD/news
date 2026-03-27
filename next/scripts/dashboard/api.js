// ============================================================
// api.js — All Supabase interactions (reads, writes, uploads)
// ============================================================

const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
export const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

export async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

export async function signOut() {
    await supabaseClient.auth.signOut();
}

// ─────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────

export async function fetchProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) console.error("Profile Fetch Error:", error.message);
    return data;
}

export async function updateProfile(userId, fields) {
    const { error } = await supabaseClient
        .from('profiles')
        .update(fields)
        .eq('id', userId);
    return { error };
}

export async function upsertProfile(userId, fields) {
    const { error } = await supabaseClient
        .from('profiles')
        .upsert({ id: userId, ...fields }, { onConflict: 'id' });
    return { error };
}

export async function fetchSenderName(userId) {
    const { data } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
    return data?.full_name || null;
}

// ─────────────────────────────────────────
// AVATAR STORAGE
// ─────────────────────────────────────────

export async function uploadAvatar(userId, file) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    // Remove old file first to avoid stale cache
    await supabaseClient.storage.from('avatars').remove([filePath]);

    const { error: upErr } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (upErr) return { error: upErr, publicUrl: null };

    const { data: { publicUrl } } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return { error: null, publicUrl };
}

// ─────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────

export async function fetchTodaysSchedule(userId, dayOfWeek) {
    const { data } = await supabaseClient
        .from('student_schedule')
        .select('*')
        .eq('student_id', userId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true });
    return data || [];
}

export async function fetchWeeklySchedule(userId) {
    const { data } = await supabaseClient
        .from('student_schedule')
        .select('*')
        .eq('student_id', userId)
        .order('start_time', { ascending: true });
    return data || [];
}

export async function fetchNextClass(userId, dayOfWeek, nowTime) {
    const { data } = await supabaseClient
        .from('student_schedule')
        .select('*')
        .eq('student_id', userId)
        .eq('day_of_week', dayOfWeek)
        .gt('start_time', nowTime)
        .order('start_time', { ascending: true })
        .limit(1);
    return data?.[0] || null;
}

// ─────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────

export async function fetchPersonalMessages(userId) {
    const { data } = await supabaseClient
        .from('portal_messages')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });
    return data || [];
}

export async function fetchAnnouncements() {
    const { data } = await supabaseClient
        .from('portal_messages')
        .select('*')
        .is('recipient_id', null)
        .order('created_at', { ascending: false });
    return data || [];
}

export async function fetchUnreadCount(userId) {
    const { count } = await supabaseClient
        .from('portal_messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);
    return count || 0;
}

export async function markMessageRead(msgId) {
    await supabaseClient
        .from('portal_messages')
        .update({ is_read: true })
        .eq('id', msgId);
}

export async function sendMessage({ recipientId, senderId, senderName, subject, content }) {
    const { error } = await supabaseClient.from('portal_messages').insert({
        recipient_id: recipientId || null,
        sender_id: senderId,
        sender_name: senderName,
        subject,
        content,
        is_read: false
    });
    return { error };
}

// ─────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────

export async function fetchPayments(userId) {
    const { data } = await supabaseClient
        .from('student_payments')
        .select('*')
        .eq('student_id', userId);
    return data || [];
}

export async function fetchUnpaidTotal(userId) {
    const { data } = await supabaseClient
        .from('student_payments')
        .select('amount')
        .eq('student_id', userId)
        .neq('status', 'Paid');
    return data || [];
}

// ─────────────────────────────────────────
// DEADLINES
// ─────────────────────────────────────────

export async function fetchDeadlines(userId) {
    const { data, error } = await supabaseClient
        .from('deadlines')
        .select('*')
        .eq('student_id', userId)
        .order('due_date', { ascending: true });
    return { data: data || [], error };
}

export async function fetchNextDeadline(userId) {
    const { data } = await supabaseClient
        .from('deadlines')
        .select('title, due_date, status')
        .eq('student_id', userId)
        .neq('status', 'submitted')
        .order('due_date', { ascending: true })
        .limit(1);
    return data?.[0] || null;
}

// ─────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────

export async function fetchCourses(userId) {
    const { data } = await supabaseClient
        .from('student_courses')
        .select('*')
        .eq('student_id', userId);
    return data || [];
}

// ─────────────────────────────────────────
// GRADES
// ─────────────────────────────────────────

export async function fetchGrades(userId) {
    const { data } = await supabaseClient
        .from('student_grades')
        .select('*')
        .eq('student_id', userId);
    return data || [];
}

export async function fetchGradesForChart(userId) {
    const { data } = await supabaseClient
        .from('student_grades')
        .select('course_name, midterm, finals')
        .eq('student_id', userId);
    return data || [];
}

export async function fetchProgressForChart(userId) {
    const { data } = await supabaseClient
        .from('student_courses')
        .select('course_name, progress')
        .eq('student_id', userId);
    return data || [];
}

// ─────────────────────────────────────────
// RESOURCES
// ─────────────────────────────────────────

export async function fetchResources() {
    const { data } = await supabaseClient
        .from('portal_resources')
        .select('*')
        .order('created_at', { ascending: false });
    return data || [];
}

// ─────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────

export async function fetchNotices() {
    const { data, error } = await supabaseClient
        .from('portal_notices')
        .select('*');
    return { data: data || [], error };
}

// ─────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────

export async function fetchAttendance(userId) {
    const { data, error } = await supabaseClient
        .from('attendance')
        .select('*')
        .eq('student_id', userId);
    return { data: data || [], error };
}