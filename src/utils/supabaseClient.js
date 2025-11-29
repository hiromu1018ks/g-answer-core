import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tcjyjsjfcbsjvsyksobl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjanlqc2pmY2JzanZzeWtzb2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY4MjUsImV4cCI6MjA3OTk5MjgyNX0.HTK1kEbq3Iywl0Y_8mpjoeKSyvZG-MequEcBt16n3uY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
