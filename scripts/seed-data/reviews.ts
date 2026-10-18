interface ReviewText {
  title: string;
  body: string;
}

// Review texts by star rating, used by the demo seed
export const reviewPool: Record<number, ReviewText[]> = {
  5: [
    { title: "Saved me weeks of work", body: "I was planning to build all of this myself. The code is clean, well organised and the docs walk you through every step. Had it deployed the same afternoon." },
    { title: "Best purchase this year", body: "Honestly worth several times the price. Everything is typed, components are reusable and it was easy to rebrand to match our design system." },
    { title: "Excellent code quality", body: "As a senior developer I'm picky about code I didn't write. This passed our code review with almost no changes. Clear folder structure and sensible naming throughout." },
    { title: "Support is outstanding", body: "Had a question about deployment and got a detailed answer within a few hours. The updates keep coming too — the latest version added features I was about to build." },
    { title: "Looks even better than the preview", body: "The screenshots don't do it justice. Animations are smooth, it's fully responsive and dark mode is done properly, not as an afterthought." },
    { title: "Perfect starting point for clients", body: "I run a small agency and we've used this for three client projects already. The extended licence pays for itself on the first project." },
    { title: "Documentation is top notch", body: "Every feature is documented with examples. Even our junior developer got it running locally without help. Rare to see this level of care." },
    { title: "Launched our MVP on it", body: "We launched our MVP on this in under two weeks and already have paying customers. Couldn't have moved that fast starting from scratch." },
  ],
  4: [
    { title: "Great, with minor gaps", body: "Really solid overall. I had to tweak a couple of components for accessibility, but the foundation is excellent and saved a lot of time." },
    { title: "Very good value", body: "Clean design and well-written code. Would love a few more page examples, but what's included is high quality and easy to extend." },
    { title: "Solid and well structured", body: "Setup took a little longer than expected because of environment variables, but once running everything worked as described. Happy with it." },
    { title: "Recommended", body: "Does exactly what it says. A couple of dependencies were slightly out of date, but updating them was painless. Good support response too." },
    { title: "Nice design, easy to customise", body: "Swapping colours and fonts took minutes thanks to the design tokens. Knocked off one star only because the docs could cover deployment in more depth." },
  ],
  3: [
    { title: "Good, but needs more docs", body: "The product itself is nice, but I struggled with parts of the setup that weren't documented. Got there in the end with help from support." },
    { title: "Decent starting point", body: "Useful foundation, though I ended up rewriting a few parts to fit our architecture. Fine if you're happy with the default structure." },
  ],
  2: [
    { title: "Not quite what I expected", body: "The design is nice but some features in the description needed extra configuration I didn't anticipate. Support did help me sort it out." },
  ],
};
