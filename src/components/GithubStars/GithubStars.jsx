import { useEffect } from "react";

const GithubStars = ({ user, repo, onFetch }) => {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [repoRes, userRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${user}/${repo}`),
          fetch(`https://api.github.com/users/${user}`),
        ]);

        const repoData = await repoRes.json();
        const userData = await userRes.json();

        if (repoRes.ok && userRes.ok) {
          const format = (num) => {
            if (num >= 1_000_000)
              return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
            if (num >= 1_000)
              return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
            return num.toString();
          };

          onFetch?.({
            stars: format(repoData.stargazers_count),
            avatarUrl: userData.avatar_url,
          });
        } else {
          console.error("GitHub API error");
        }
      } catch (error) {
        console.error("Fetch error", error);
      }
    };

    fetchData();
  }, [user, repo, onFetch]);

  return null;
};

export default GithubStars;
