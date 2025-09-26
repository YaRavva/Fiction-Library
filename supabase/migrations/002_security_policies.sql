-- Fiction Library Database Security Policies
-- Migration 002: Row Level Security Setup

-- Enable RLS on all tables
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- Series policies (публичное чтение, админы могут изменять)
CREATE POLICY "Series are viewable by everyone" ON series
    FOR SELECT USING (true);

CREATE POLICY "Only admins can insert series" ON series
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update series" ON series
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete series" ON series
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Books policies (публичное чтение, админы могут изменять)
CREATE POLICY "Books are viewable by everyone" ON books
    FOR SELECT USING (true);

CREATE POLICY "Only admins can insert books" ON books
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update books" ON books
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete books" ON books
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User profiles policies
CREATE POLICY "Users can view all profiles" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Only admins can delete profiles" ON user_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User-Series policies (только владелец)
CREATE POLICY "Users can view their own series relationships" ON user_series
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own series relationships" ON user_series
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own series relationships" ON user_series
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own series relationships" ON user_series
    FOR DELETE USING (auth.uid() = user_id);

-- User-Books policies (только владелец)
CREATE POLICY "Users can view their own book relationships" ON user_books
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own book relationships" ON user_books
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book relationships" ON user_books
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own book relationships" ON user_books
    FOR DELETE USING (auth.uid() = user_id);

-- Reading history policies (только владелец)
CREATE POLICY "Users can view their own reading history" ON reading_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading history" ON reading_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading history" ON reading_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading history" ON reading_history
    FOR DELETE USING (auth.uid() = user_id);

-- User bookmarks policies (только владелец)
CREATE POLICY "Users can view their own bookmarks" ON user_bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks" ON user_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks" ON user_bookmarks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON user_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- User ratings policies (публичное чтение, только владелец может изменять)
CREATE POLICY "Everyone can view ratings" ON user_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own ratings" ON user_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON user_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON user_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username, display_name, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
        'reader'
    );
    RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();