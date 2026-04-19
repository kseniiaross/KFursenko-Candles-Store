import React from "react";
import { Link } from "react-router-dom";
import "../styles/StoryMission.css";

import img1 from "../assets/images/story_mission/story_mission1.jpg";
import img2 from "../assets/images/story_mission/story_mission2.jpg";
import img3 from "../assets/images/story_mission/story_mission3.jpg";
import img4 from "../assets/images/story_mission/story_mission4.jpg";
import img5 from "../assets/images/story_mission/story_mission5.jpg";
import img6 from "../assets/images/story_mission/story_mission6.jpg";
import img7 from "../assets/images/story_mission/story_mission7.jpg";
import img8 from "../assets/images/story_mission/story_mission8.jpg";
import img9 from "../assets/images/story_mission/story_mission9.jpg";
import img10 from "../assets/images/story_mission/story_mission10.jpg";

type Section = {
  title: string;
  body: string;
  img: string;
  alt: string;
};

const sections: Section[] = [
  {
    title: "The Beginning",
    body:
      "KFursenko Candles began in New York with a simple ritual: a quiet evening, a clean flame, and a scent that makes a space feel like home. Kseniia Fursenko didn’t start with a factory plan — she started with a feeling. The kind you remember: soft light on the table, fresh air through a window, and a calm that stays with you.",
    img: img1,
    alt: "A candle held in hands, warm flame and brand label",
  },
  {
    title: "Craft, Not Noise",
    body:
      "Each candle is made in small batches, with careful attention to wax texture, wick placement, and the way a fragrance opens over time. We obsess over the details you can’t always see — because you can always feel them. Clean burn. Balanced throw. A scent that doesn’t shout, it invites.",
    img: img2,
    alt: "Close-up of candle wick being set into wax",
  },
  {
    title: "A Label You Can Feel",
    body:
      "Packaging is part of the experience. The first touch, the first look, the moment you place it on a shelf — it should feel intentional. Minimal, elegant, and quietly luxurious. Like a beautiful object that belongs in your space, not just a product you use and forget.",
    img: img3,
    alt: "Pouring melted wax into black containers in a bright kitchen",
  },
  {
    title: "Slow Luxury for Everyday Life",
    body:
      "We believe luxury can be simple: a clean design, a soft scent, and the comfort of a ritual you return to. Light it while you read, while you cook, while you reset your thoughts after a long day. The goal isn’t perfection — it’s presence.",
    img: img4,
    alt: "Melted wax being poured close-up into a container",
  },
  {
    title: "Designed to Belong",
    body:
      "KFursenko Candles are created to live with you — on your desk, your nightstand, your dining table. A candle should never fight the room. It should complete it: understated, refined, and always warm.",
    img: img5,
    alt: "Hands holding a candle jar and label detail",
  },
  {
    title: "Story",
    body:
      "Kseniia’s story is a blend of creativity and discipline: learning the craft, testing combinations, refining every step until it feels right. From New York apartments to bright worktables, the process stayed the same — careful, consistent, and deeply personal.",
    img: img6,
    alt: "Hands placing a printed label onto a candle container",
  },
  {
    title: "Mission",
    body:
      "Our mission is to make candles that elevate everyday moments. We create scents that feel clean and modern, designs that look effortless, and products that turn a space into a mood. Not just for special occasions — for the days that actually make up your life.",
    img: img7,
    alt: "Wax flakes being poured into a pot, preparation for candle making",
  },
  {
    title: "Why We Make Them",
    body:
      "Because a home isn’t only furniture — it’s atmosphere. A candle is the fastest way to change how a room feels. Our scents are composed to be wearable for a space: layered, smooth, and memorable.",
    img: img8,
    alt: "Close-up of wax flakes in a small cup held in hand",
  },
  {
    title: "From New York, With Calm",
    body:
      "New York teaches you pace. KFursenko Candles is the opposite: an invitation to slow down. A small ritual, a steady flame, and a space that finally feels like yours.",
    img: img9,
    alt: "Candle-making process scene with clean minimal setup",
  },
  {
    title: "Welcome to Your Ritual",
    body:
      "This is your permission to pause. To light something beautiful. To treat an ordinary evening as worthy of intention. If you’re looking for a candle that feels like a quiet kind of luxury — you’re in the right place.",
    img: img10,
    alt: "Candle-making lifestyle scene, hands and product details",
  },
];

const StoryMission: React.FC = () => {
  return (
    <main className="story" aria-label="Story and Mission">
      <header className="story__hero">
        <div className="story__container">
          <div className="story__heroInner">
            <h1 className="story__title">Story &amp; Mission</h1>
            <p className="story__subtitle">
              KFursenko Candles by Kseniia Fursenko, New York - slow luxury, made
              to feel like home.
            </p>

            <nav className="story__nav" aria-label="Quick navigation">
              <a className="story__navLink" href="#story">
                Story
              </a>
              <a className="story__navLink" href="#mission">
                Mission
              </a>
              <Link className="story__navLink" to="/catalog">
                Shop
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="story__content" aria-label="Illustrated story">
        <div className="story__container">
          {sections.map((s, idx) => {
            const flip = idx % 2 === 1;
            return (
              <article
                key={s.title}
                className={`story__section ${flip ? "story__section--flip" : ""}`}
              >
                <div className="story__media">
                  <img className="story__img" src={s.img} alt={s.alt} loading="lazy" />
                </div>

                <div className="story__text">
                  <h2 className="story__h2">{s.title}</h2>
                  <p className="story__p">{s.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="story__callouts" aria-label="Story and mission highlights">
        <div className="story__container story__calloutsGrid">
          <div className="story__callout" id="story">
            <h3 className="story__h3">Story</h3>
            <p className="story__p">
              Founded by Kseniia Fursenko in New York, KFursenko Candles is built on
              craftsmanship, calm design, and scents that feel modern, soft, and
              intentional.
            </p>
          </div>

          <div className="story__callout" id="mission">
            <h3 className="story__h3">Mission</h3>
            <p className="story__p">
              To elevate everyday life with candles that look beautiful in your home
              and create an atmosphere you’ll want to return to — again and again.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default StoryMission;