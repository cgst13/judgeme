# JudgeMe - Event Judging Platform

A modern, responsive web application for managing professional judging events. Built with React.js, Tailwind CSS, and Supabase for authentication, database, and file storage.

## Features

### 🎯 Core Features
- **Event Creation**: Multi-step form to create judging events with custom criteria
- **Real-time Scoring**: Live updates as judges submit scores
- **Secure Access**: Protected events with unique 6-character access codes
- **Mobile-Friendly**: Fully responsive design that works on all devices
- **Export Results**: Download scores and results in Excel format

### 👥 User Roles

#### Event Creator (Admin)
- Create and manage judging events
- Upload event logos
- Set custom judging criteria with weighted percentages
- Add candidates with their representations
- View real-time results and rankings
- Export results to Excel/CSV
- Manage judges and candidates

#### Judges
- Join events using access codes
- Evaluate candidates using predefined criteria
- Submit scores with weighted calculations
- View progress through all candidates

### 🎨 Design Features
- Clean, minimal UI using Tailwind CSS
- Green and white color scheme
- Modern, professional appearance
- Intuitive user experience
- Responsive design for all screen sizes

## Tech Stack

- **Frontend**: React.js 18, React Router v6
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Notifications**: React Hot Toast
- **Export**: XLSX library
- **Deployment**: GitHub Pages

## Prerequisites

Before running this application, you need:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **Supabase Account** - Create a free account at [supabase.com](https://supabase.com)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/judgeme.git
cd judgeme
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project in Supabase
2. Go to Settings > API to get your project URL and anon key
3. Create the following database tables:

#### Events Table
```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  access_code TEXT UNIQUE NOT NULL,
  num_judges INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Criteria Table
```sql
CREATE TABLE criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Candidates Table
```sql
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  representation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Judges Table
```sql
CREATE TABLE judges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Scores Table
```sql
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  judge_id UUID REFERENCES judges(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

4. Create a storage bucket named `event-logos` for storing event logos
5. Set up Row Level Security (RLS) policies for your tables

### 4. Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Update GitHub Pages Configuration

In `package.json`, update the homepage URL:

```json
{
  "homepage": "https://yourusername.github.io/judgeme"
}
```

### 6. Run the Application

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Deployment to GitHub Pages

### 1. Install gh-pages

```bash
npm install --save-dev gh-pages
```

### 2. Deploy

```bash
npm run deploy
```

### 3. Configure GitHub Pages

1. Go to your repository settings
2. Navigate to Pages section
3. Set source to "Deploy from a branch"
4. Select `gh-pages` branch
5. Save the configuration

## Usage Guide

### Creating an Event

1. Visit the landing page
2. Click "Create Event"
3. Sign up or sign in with your email
4. Follow the 3-step process:
   - **Step 1**: Enter event name, upload logo, set number of judges
   - **Step 2**: Define judging criteria with percentages (must total 100%)
   - **Step 3**: Add candidates with their names and representations
5. Get your unique 6-character access code

### Joining as a Judge

1. Visit the landing page
2. Click "Access Event"
3. Enter the event access code
4. Enter your name to join as a judge
5. Start evaluating candidates using the predefined criteria

### Managing Events (Admin)

1. Sign in to your account
2. View all your created events in the dashboard
3. Click "View Details" to see real-time results
4. Export results to Excel format
5. Monitor judge participation and scoring progress

## File Structure

```
judgeme/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Auth.js
│   │   ├── LandingPage.js
│   │   ├── CreateEvent.js
│   │   ├── AccessEvent.js
│   │   ├── JudgePanel.js
│   │   ├── AdminDashboard.js
│   │   └── EventDetails.js
│   ├── contexts/
│   │   └── AuthContext.js
│   ├── App.js
│   ├── index.js
│   ├── index.css
│   └── supabase.js
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/judgeme/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## Acknowledgments

- [Supabase](https://supabase.com) for the backend infrastructure
- [Tailwind CSS](https://tailwindcss.com) for the styling framework
- [React](https://reactjs.org) for the frontend framework
- [React Router](https://reactrouter.com) for routing
- [React Hot Toast](https://react-hot-toast.com) for notifications 